function normalizedText(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[®™©]/g, "")
    .replace(/&/g, " and ")
    .replace(/×/g, " x ")
    .replace(/[’']/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function phraseState(text, states) {
  const normalized = ` ${text} `;
  const matches = states
    .filter(({ phrase }) => normalized.includes(` ${phrase} `))
    .sort((left, right) => right.phrase.length - left.phrase.length);
  if (matches.length === 0) return null;

  const mostSpecificLength = matches[0].phrase.length;
  const unique = [...new Set(
    matches
      .filter(({ phrase }) => phrase.length === mostSpecificLength)
      .map(({ state }) => state),
  )];
  return unique.length === 1 ? unique[0] : null;
}

function stateConflict(leftText, rightText, states, contextPattern = null) {
  const combined = `${leftText} ${rightText}`;
  if (contextPattern && !contextPattern.test(combined)) return false;
  const left = phraseState(leftText, states);
  const right = phraseState(rightText, states);
  return Boolean(left && right && left !== right);
}

function stateSet(text, states) {
  const normalized = ` ${text} `;
  return new Set(
    states
      .filter(({ phrase }) => normalized.includes(` ${phrase} `))
      .map(({ state }) => state),
  );
}

function disjointStateConflict(leftText, rightText, states, contextPattern = null) {
  const combined = `${leftText} ${rightText}`;
  if (contextPattern && !contextPattern.test(combined)) return false;
  const left = stateSet(leftText, states);
  const right = stateSet(rightText, states);
  if (!left.size || !right.size) return false;
  return ![...left].some((state) => right.has(state));
}

function presenceConflict(leftText, rightText, pattern, contextPattern = null) {
  const left = leftText;
  const right = rightText;
  if (contextPattern && !contextPattern.test(`${left} ${right}`)) return false;
  return pattern.test(left) !== pattern.test(right);
}

const states = (...phrases) => phrases.map((phrase) => ({ phrase, state: phrase }));
const aliases = (entries) => entries.map(([phrase, state]) => ({ phrase, state }));

export function productUrlVariantHints(value) {
  const normalized = normalizedText(value);
  const phrases = [
    "barista lovers",
    "barista",
    "cream cheese icing",
    "fresh ground",
    "ground coffee",
    "original cinnamon rolls",
    "peach",
    "raspberry",
    "strawberry",
    "cinnamon",
    "whole bean",
  ];
  const hints = phrases
    .filter((phrase) => ` ${normalized} `.includes(` ${phrase} `))
    .join(" ");
  const count = normalized.match(/\b(\d+)\s*(?:count|ct|each|ea|pack|pk)\b/);
  return `${hints} ${count ? `${count[1]} count` : ""}`.trim();
}

function explicitPackDetails(text) {
  const normalized = String(text ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/×/g, " x ")
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
  const packOf = normalized.match(/\b(?:pack|case)\s+of\s+(\d+)\b/);
  const leadingPack = normalized.match(/\b(\d+)\s*(?:pack|pk)\b/);
  const multiplied = normalized.match(/\b(\d+)\s*x\s*\d+(?:\.\d+)?\s*(?:fl\s*oz|fz|oz|lb|g|ml|l)\b/);
  const countUnit = normalized.match(/\b(\d+)\s*(?:count|ct|each|ea)\b/);
  for (const [rawCount, kind] of [
    [packOf?.[1], "pack"],
    [leadingPack?.[1], "pack"],
    [multiplied?.[1], "pack"],
    [countUnit?.[1], "count"],
  ]) {
    const count = Number(rawCount);
    if (count > 1) return { count, kind };
  }
  return null;
}

export function packagedProductVariantsCompatible(leftValue, rightValue) {
  const leftText = normalizedText(leftValue);
  const rightText = normalizedText(rightValue);
  const leftPack = explicitPackDetails(leftValue);
  const rightPack = explicitPackDetails(rightValue);
  const packConflict = leftPack && rightPack
    ? leftPack.count !== rightPack.count
    : leftPack?.kind === "pack" || rightPack?.kind === "pack";
  const conflicts = [
    Boolean(packConflict),
    stateConflict(leftText, rightText, states("unsalted", "salted")),
    stateConflict(leftText, rightText, states("unsweetened", "sweetened")),
    stateConflict(leftText, rightText, states("decaf", "caffeinated"), /\b(?:coffee|tea)\b/),
    stateConflict(
      leftText,
      rightText,
      aliases([
        ["ground coffee", "ground"],
        ["ground", "ground"],
        ["whole bean", "whole bean"],
        ["k cup", "pod"],
        ["k cups", "pod"],
        ["coffee pod", "pod"],
        ["coffee pods", "pod"],
        ["single serve coffee pods", "pod"],
      ]),
      /\bcoffee\b/,
    ),
    stateConflict(
      leftText,
      rightText,
      states("extra sharp", "sharp", "medium", "mild"),
      /\b(?:cheese|cheddar)\b/,
    ),
    stateConflict(leftText, rightText, states("creamy", "crunchy"), /\bpeanut butter\b/),
    stateConflict(
      leftText,
      rightText,
      states("tikka masala", "butter chicken", "chicken biryani", "biryani", "korma", "saag paneer"),
      /\b(?:indian|chicken|meal|biryani|korma|paneer)\b/,
    ),
    stateConflict(leftText, rightText, states("chicken", "beef", "vegetable", "mushroom"), /\b(?:broth|stock)\b/),
    stateConflict(
      leftText,
      rightText,
      aliases([
        ["penne", "penne"],
        ["rotini", "rotini"],
        ["spaghetti", "spaghetti"],
        ["fettuccine", "fettuccine"],
        ["linguine", "linguine"],
        ["elbows", "elbow"],
        ["elbow", "elbow"],
        ["shells", "shell"],
        ["shell", "shell"],
      ]),
      /\b(?:pasta|noodle|macaroni)\b/,
    ),
    stateConflict(
      leftText,
      rightText,
      states("dark chocolate", "milk chocolate", "white chocolate"),
      /\bchocolate\b/,
    ),
    stateConflict(
      leftText,
      rightText,
      aliases([
        ["dark chocolate", "dark"],
        ["dark", "dark"],
        ["milk chocolate", "milk"],
        ["milk", "milk"],
        ["white chocolate", "white"],
        ["white", "white"],
      ]),
      /\b(?:chocolate|cocoa)\b/,
    ),
    stateConflict(
      leftText,
      rightText,
      aliases([
        ["white cheddar", "cheddar"],
        ["sharp cheddar", "cheddar"],
        ["cheddar", "cheddar"],
        ["mozzarella", "mozzarella"],
        ["provolone", "provolone"],
        ["gouda", "gouda"],
        ["swiss", "swiss"],
        ["parmesan", "parmesan"],
        ["asiago", "asiago"],
        ["colby jack", "colby jack"],
        ["monterey jack", "monterey jack"],
        ["pepper jack", "pepper jack"],
        ["brie", "brie"],
        ["feta", "feta"],
      ]),
      /\b(?:cheese|cheddar|mozzarella|provolone|gouda|swiss|parmesan|asiago|brie|feta)\b/,
    ),
    stateConflict(
      leftText,
      rightText,
      states("strawberry", "blueberry", "vanilla", "peach", "plain"),
      /\b(?:yogurt|skyr)\b/,
    ),
    stateConflict(
      leftText,
      rightText,
      states("oat", "almond", "coconut", "soy", "cashew"),
      /\b(?:milk|creamer|barista)\b/,
    ),
    stateConflict(
      leftText,
      rightText,
      aliases([
        ["barista lovers", "barista"],
        ["barista", "barista"],
        ["extra creamy", "extra creamy"],
        ["full fat", "full fat"],
      ]),
      /\b(?:milk|oatmilk|creamer|barista)\b/,
    ),
    stateConflict(
      leftText,
      rightText,
      aliases([
        ["shelf stable", "ambient"],
        ["ambient", "ambient"],
        ["chilled", "chilled"],
      ]),
      /\b(?:milk|oatmilk|creamer|barista)\b/,
    ),
    presenceConflict(
      leftText,
      rightText,
      /\b(?:barista|latte)\b/,
      /\b(?:milk|creamer|barista|latte)\b/,
    ),
    presenceConflict(
      leftText,
      rightText,
      /\bvanilla\b/,
      /\b(?:milk|creamer|barista)\b/,
    ),
    disjointStateConflict(
      leftText,
      rightText,
      aliases([
        ["whole wheat", "wheat"],
        ["wheat", "wheat"],
        ["white bread", "white"],
        ["white", "white"],
        ["classic french", "french"],
        ["french bread", "french"],
        ["great seed", "great seed"],
        ["twenty four", "twenty four"],
        ["powerseed", "powerseed"],
        ["supreme sourdough", "sourdough"],
        ["sourdough", "sourdough"],
      ]),
      /\bbread\b/,
    ),
    stateConflict(
      leftText,
      rightText,
      states("classic french", "classic sourdough"),
      /\bseattle\s+sourdough\b|\bseattle\s+international\b/,
    ),
    stateConflict(
      leftText,
      rightText,
      states("tomato sauce", "pizza sauce", "marinara sauce", "vodka sauce"),
      /\bsauce\b/,
    ),
    stateConflict(
      leftText,
      rightText,
      states("banana cream", "orange cream", "cream soda", "peaches and cream"),
      /\b(?:olipop|soda)\b/,
    ),
    stateConflict(
      leftText,
      rightText,
      aliases([
        ["cherry cola", "cherry cola"],
        ["classic cola", "classic cola"],
        ["original cola", "classic cola"],
        ["raspberry rose", "raspberry rose"],
        ["strawberry lemon", "strawberry lemon"],
        ["root beer", "root beer"],
        ["classic grape", "grape"],
        ["ginger ale", "ginger ale"],
        ["gingerberry", "gingerberry"],
        ["honeycrisp apple", "honeycrisp apple"],
        ["pomelo pink lemonade", "pomelo pink lemonade"],
        ["peach paradise", "peach paradise"],
      ]),
      /\b(?:poppi|olipop|synergy|kombucha|soda|cola)\b/,
    ),
    stateConflict(
      leftText,
      rightText,
      aliases([
        ["himalayan pink salt", "pink salt"],
        ["pink salt", "pink salt"],
        ["himalayan gold", "himalayan gold"],
      ]),
      /\b(?:popcorn|lesserevil)\b/,
    ),
    stateConflict(
      leftText,
      rightText,
      aliases([
        ["classic sea salt", "sea salt"],
        ["sea salt", "sea salt"],
        ["malt vinegar and sea salt", "vinegar"],
        ["sea salt and vinegar", "vinegar"],
        ["salt and vinegar", "vinegar"],
        ["salt n pepper", "salt and pepper"],
        ["salt and pepper", "salt and pepper"],
        ["backyard barbeque", "barbecue"],
        ["backyard barbecue", "barbecue"],
        ["barbeque", "barbecue"],
        ["barbecue", "barbecue"],
        ["bbq", "barbecue"],
        ["jalapeno", "jalapeno"],
        ["lime", "lime"],
        ["sour cream and onion", "sour cream and onion"],
        ["cheddar and sour cream", "cheddar and sour cream"],
      ]),
      /\b(?:chip|chips|crisp|crisps)\b/,
    ),
    stateConflict(
      leftText,
      rightText,
      aliases([
        ["classic bbq", "classic"],
        ["classic barbecue", "classic"],
        ["original bbq", "classic"],
        ["original barbecue", "classic"],
        ["hawaiian style", "hawaiian"],
        ["hawaiian", "hawaiian"],
        ["golden", "golden"],
        ["honey", "honey"],
      ]),
      /\b(?:bbq|barbecue)\s+sauce\b/,
    ),
    stateConflict(
      leftText,
      rightText,
      aliases([
        ["chicken and maple", "maple"],
        ["maple", "maple"],
        ["sage", "sage"],
        ["apple", "apple"],
      ]),
      /\bsausage\b/,
    ),
    stateConflict(
      leftText,
      rightText,
      states("buttermilk", "buckwheat", "protein", "original"),
      /\b(?:pancake|waffle)\b/,
    ),
    stateConflict(
      leftText,
      rightText,
      aliases([
        ["red chile", "red"],
        ["red chili", "red"],
        ["green chile", "green"],
        ["green chili", "green"],
      ]),
      /\b(?:habanero|hot sauce)\b/,
    ),
    stateConflict(
      leftText,
      rightText,
      states("yellow corn", "white corn", "blue corn"),
      /\b(?:tortilla|tortillas|chip|chips)\b/,
    ),
    stateConflict(
      leftText,
      rightText,
      aliases([
        ["honey butter", "honey butter"],
        ["original", "original"],
      ]),
      /\b(?:corn bread|cornbread|muffin)\b/,
    ),
    stateConflict(
      leftText,
      rightText,
      states("jar", "packets"),
      /\b(?:sweetener|stevia|truvia)\b/,
    ),
    stateConflict(
      leftText,
      rightText,
      aliases([
        ["peanut butter", "peanut butter"],
        ["cocoa", "cocoa"],
        ["salted caramel", "salted caramel"],
        ["espresso", "espresso"],
      ]),
      /\b(?:almond|almonds)\b/,
    ),
    stateConflict(
      leftText,
      rightText,
      states("muesli", "flaxseed meal", "granola", "oatmeal"),
    ),
    stateConflict(
      leftText,
      rightText,
      states("original", "coconut"),
      /\bjasberry\b|\bsuperfood\s+rice\b/,
    ),
    stateConflict(
      leftText,
      rightText,
      states("chocolate chip", "chocolate mint"),
      /\b(?:bar|protein)\b/,
    ),
    stateConflict(
      leftText,
      rightText,
      states("classic chai", "skinny chai"),
      /\b(?:chai|latte)\b/,
    ),
    stateConflict(
      leftText,
      rightText,
      aliases([
        ["oatmeal raisin", "oatmeal raisin"],
        ["lemon", "lemon"],
        ["chunky fudgy", "chunky"],
        ["chunky", "chunky"],
        ["original", "original"],
      ]),
      /\b(?:cookie|cookies|chips ahoy|tates)\b/,
    ),
    stateConflict(
      leftText,
      rightText,
      states("cream cheese icing", "original"),
      /\b(?:cinnamon roll|cinnamon rolls)\b/,
    ),
    stateConflict(
      leftText,
      rightText,
      aliases([
        ["cracked pepper and olive oil", "cracked pepper"],
        ["cracked pepper", "cracked pepper"],
        ["rosemary and olive oil", "rosemary"],
        ["rosemary", "rosemary"],
      ]),
      /\btriscuit\b/,
    ),
    stateConflict(
      leftText,
      rightText,
      states(
        "garlic and fine herbs",
        "hot honey garlic",
        "shallot and chive",
        "cracked black pepper",
      ),
      /\bboursin\b/,
    ),
    stateConflict(
      leftText,
      rightText,
      states(
        "mexican wedding",
        "mexican vanilla chocolate chip",
        "mexican shortbread",
        "fresas con crema",
      ),
      /\b(?:cookie|cookies)\b/,
    ),
    stateConflict(
      leftText,
      rightText,
      aliases([
        ["chicken", "chicken"],
        ["turkey", "turkey"],
        ["beef", "beef"],
        ["pork", "pork"],
        ["ham", "pork"],
        ["salmon", "salmon"],
        ["tuna", "tuna"],
        ["shrimp", "shrimp"],
        ["cod", "cod"],
        ["lamb", "lamb"],
        ["duck", "duck"],
      ]),
    ),
    disjointStateConflict(
      leftText,
      rightText,
      aliases([
        ["cherries", "cherry"],
        ["cherry", "cherry"],
        ["raspberries", "raspberry"],
        ["raspberry", "raspberry"],
        ["strawberries", "strawberry"],
        ["strawberry", "strawberry"],
        ["blueberries", "blueberry"],
        ["blueberry", "blueberry"],
        ["peaches", "peach"],
        ["peach", "peach"],
        ["mango", "mango"],
        ["pineapple", "pineapple"],
        ["banana", "banana"],
        ["honeycrisp apple", "apple"],
        ["apple", "apple"],
        ["orange", "orange"],
        ["lemon", "lemon"],
        ["lime", "lime"],
        ["grape", "grape"],
        ["watermelon", "watermelon"],
        ["coconut", "coconut"],
        ["pistachio", "pistachio"],
        ["pomelo", "pomelo"],
        ["rhubarb", "rhubarb"],
        ["apricot", "apricot"],
        ["raisin", "raisin"],
        ["butterscotch", "butterscotch"],
        ["cinnamon", "cinnamon"],
        ["rosemary", "rosemary"],
        ["cracked pepper", "cracked pepper"],
        ["dill pickle", "dill pickle"],
        ["jalapeno", "jalapeno"],
        ["fig", "fig"],
      ]),
    ),
    stateConflict(
      leftText,
      rightText,
      aliases([
        ["shredded", "shreds"],
        ["shreds", "shreds"],
        ["shred", "shreds"],
        ["sliced", "slices"],
        ["slices", "slices"],
        ["slice", "slices"],
        ["block", "block"],
      ]),
      /\b(?:cheese|cheddar|chao)\b/,
    ),
    stateConflict(
      leftText,
      rightText,
      states("ball", "perline"),
      /\bmozzarella\b/,
    ),
    stateConflict(leftText, rightText, states("lightly salted", "salted")),
    presenceConflict(leftText, rightText, /\bair fried\b/, /\b(?:chip|chips)\b/),
    presenceConflict(
      leftText,
      rightText,
      /\b(?:spicy|fiery hot)\b/,
      /\b(?:cheese|chicken|chickn|chip|chips|filet|meat|sausage|snack)\b/,
    ),
    presenceConflict(leftText, rightText, /\bwhipped\b/, /\b(?:butter|spread)\b/),
    presenceConflict(
      leftText,
      rightText,
      /\b(?:oat|almond|coconut|soy|cashew)\b/,
      /\b(?:creamer|barista)\b/,
    ),
    presenceConflict(leftText, rightText, /\blight\b/, /\b(?:mayo|mayonnaise)\b/),
    presenceConflict(leftText, rightText, /\bpeppered\b/, /\b(?:salami|deli meat)\b/),
    presenceConflict(leftText, rightText, /\bcinnamon\b/, /\bapple\s*sauce\b|\bapplesauce\b/),
    presenceConflict(leftText, rightText, /\bdill pickle\b/, /\b(?:tuna|fish)\b/),
    presenceConflict(
      leftText,
      rightText,
      /\b(?:simply|no artificial sweeteners)\b/,
      /\bketchup\b/,
    ),
    presenceConflict(
      leftText,
      rightText,
      /\bbuffalo\b/,
      /\b(?:chicken strips|dippers|prepared)\b/,
    ),
    presenceConflict(leftText, rightText, /\bmultipack\b/),
    presenceConflict(leftText, rightText, /\bmax\b/, /\bspylt\b|\bchocolate\s+milk\b/),
    presenceConflict(leftText, rightText, /\b(?:cheese|cheddar|cheeze)\b/, /\bburrito\b/),
    presenceConflict(leftText, rightText, /\bblack bean\b/, /\bburrito\b/),
    presenceConflict(leftText, rightText, /\btomato alla vodka\b/, /\b(?:bean|beans)\b/),
  ];
  return !conflicts.some(Boolean);
}
