function normalizedText(value) {
  return String(value ?? "")
    .replace(/[®™©]/g, "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/×/g, " x ")
    .replace(/[’']/g, "")
    .toLowerCase()
    .replace(/\bunsweetned\b/g, "unsweetened")
    .replace(/\bwhite kidney beans?\b/g, "cannellini beans")
    .replace(/\bapple cider vinegar\b/g, "cider vinegar")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function stateSet(text, states) {
  const normalized = ` ${text} `;
  return new Set(
    states
    .filter(({ phrase }) => normalized.includes(` ${phrase} `))
      .map(({ state }) => state),
  );
}

function stateConflict(leftText, rightText, states, contextPattern = null) {
  const combined = `${leftText} ${rightText}`;
  if (contextPattern && !contextPattern.test(combined)) return false;
  const left = stateSet(leftText, states);
  const right = stateSet(rightText, states);
  if (!left.size || !right.size) return false;
  return left.size !== right.size || [...left].some((state) => !right.has(state));
}

function stateClaimConflict(leftText, rightText, states, contextPattern = null) {
  const combined = `${leftText} ${rightText}`;
  if (contextPattern && !contextPattern.test(combined)) return false;
  const left = stateSet(leftText, states);
  const right = stateSet(rightText, states);
  if (!left.size && !right.size) return false;
  return left.size !== right.size || [...left].some((state) => !right.has(state));
}

function presenceConflict(leftText, rightText, pattern, contextPattern = null) {
  const left = leftText;
  const right = rightText;
  if (contextPattern && !contextPattern.test(`${left} ${right}`)) return false;
  return pattern.test(left) !== pattern.test(right);
}

const states = (...phrases) => phrases.map((phrase) => ({ phrase, state: phrase }));
const aliases = (entries) => entries.map(([phrase, state]) => ({ phrase, state }));
const asymmetricVariantGuards = [
  { pattern: /\b(?:zero|no|less|reduced)\s+sugar\b/ },
  { pattern: /\b(?:low|less|reduced)\s+sodium\b/ },
  { pattern: /\bunsweet(?:ened)?\b/, context: /\b(?:milk|almondmilk|oatmilk|soymilk|coconutmilk|creamer|yogurt|beverage|drink)\b/ },
  { pattern: /\blactose free\b/, context: /\b(?:milk|cream|creamer|yogurt|dairy)\b/ },
  { pattern: /\b(?:nonfat|non fat|lowfat|low fat|reduced fat)\b/, context: /\b(?:milk|cream|yogurt|cottage cheese)\b/ },
  { pattern: /\bdha\b/, context: /\bmilk\b/ },
  { pattern: /\bwhite cheddar\b/, context: /\b(?:cheese|cheddar|macaroni|pasta)\b/ },
  { pattern: /\bpeanut butter\b/, context: /\b(?:bar|cookie|cereal|chocolate|oat)\b/ },
  { pattern: /\bbone\b/, context: /\b(?:broth|stock)\b/ },
  { pattern: /\bchocolate\b/, context: /\bmilk\b/ },
  { pattern: /\b(?:light|lite)\b/, context: /\b(?:butter|spread|dressing|mayonnaise|mayo|milk|oatmilk|beer|beverage|drink|soda|tonic)\b/ },
  { pattern: /\bspread\b/, context: /\bcream cheese\b/ },
  { pattern: /\bmini\b/, context: /\b(?:ravioli|pasta|pizza|ice cream|bar|bars|cookie|cookies|wafer|wafers)\b/ },
  { pattern: /\b(?:almond|fudge)\b/, context: /\b(?:ice cream|bar|chocolate|topping)\b/ },
  { pattern: /\bgarlic\b/, context: /\b(?:sauce|marinara|dressing)\b/ },
  { pattern: /\bbuttermilk\b/, context: /\bbread\b/ },
  { pattern: /\bbuttermilk\b/, context: /\b(?:pancake|waffle)\b/ },
  { pattern: /\bhot\b/, context: /\bsausage\b/ },
  { pattern: /\bmulti\s*grain\b/, context: /\b(?:cereal|bread)\b/ },
  { pattern: /\bhoney vanilla\b/, context: /\btea\b/ },
  { pattern: /\bchipotle\b/, context: /\b(?:mayo|mayonnaise|sauce|dressing)\b/ },
  { pattern: /\bcream\b/, context: /\b(?:poppi|soda)\b/ },
  { pattern: /\bbun length\b/, context: /\bhot dogs?\b/ },
  { pattern: /\bcheddar\b/, context: /\b(?:burger|patty|patties)\b/ },
  { pattern: /\bthick cut\b/, context: /\bbacon\b/ },
  { pattern: /\bdiet\b/, context: /\b(?:beer|beverage|drink|soda|tonic)\b/ },
  { pattern: /\bjalapeno\b/, context: /\b(?:chili|cheese|sauce|dip)\b/ },
  { pattern: /\bspinach(?:\s+and)?\s+herb\b/, context: /\btortillas?\b/ },
  { pattern: /\bno stir\b/, context: /\b(?:peanut|almond|nut)\s+butter\b/ },
  { pattern: /\bdecaf(?:feinated)?\b/, context: /\b(?:coffee|tea)\b/ },
  { pattern: /\bthin\b/, context: /\b(?:sliced|slices|cheese|mozzarella)\b/ },
  { pattern: /\bunbleached\b/, context: /\bflour\b/ },
  { pattern: /\bminestrone\b/, context: /\bsoup\b/ },
  { pattern: /\bplus calcium\b/, context: /\b(?:pasta|spaghettios)\b/ },
  { pattern: /\bblue\b/, context: /\beggs?\b/ },
  { pattern: /\bheart healthy\b/, context: /\bsoup\b/ },
  { pattern: /\bcrumbled\b/, context: /\bcheese\b/ },
  { pattern: /\bkielbasa\b/, context: /\bsausage\b/ },
  { pattern: /\b(?:raw|unfiltered)\b/, context: /\bvinegar\b/ },
  { pattern: /\bverde\b/, context: /\bsalsa\b/ },
  { pattern: /\bdeviled egg\b/, context: /\bsalad\b/ },
  { pattern: /\bblend\b/, context: /\b(?:frozen|vegetable|cauliflower)\b/ },
  { pattern: /\bvinegar\b/, context: /\b(?:chip|chips|crisp|crisps)\b/ },
  { pattern: /\bmovie theater\b/, context: /\bpopcorn\b/ },
  { pattern: /\bmature\b/, context: /\b(?:cheddar|cheese)\b/ },
  { pattern: /\bcolors\b/, context: /\b(?:cracker|crackers|goldfish)\b/ },
  { pattern: /\bcarrots?\b/, context: /\b(?:frozen|vegetable|broccoli|cauliflower)\b/ },
  { pattern: /\b(?:ultrafine|bakers)\b/, context: /\bsugar\b/ },
  { pattern: /\bspicy\b/, context: /\b(?:ketchup|sauce|mayo|mayonnaise|dressing)\b/ },
  { pattern: /\bbutter\b/, context: /\b(?:bun|buns|roll|rolls)\b/ },
  { pattern: /\b(?:simply|naked|nkd)\b/, context: /\b(?:chip|chips|doritos)\b/ },
  { pattern: /\bbean\b/, context: /\bvanilla\b/ },
  { pattern: /\bmild\b/, context: /\bseasoning\b/ },
  { pattern: /\bsmoky\b/, context: /\b(?:bbq|barbecue|chip|chips|crisp|crisps)\b/ },
  { pattern: /\bsliced\b/, context: /\bpeperoncini\b/ },
  { pattern: /\boverstuffed\b/, context: /\bravioli\b/ },
  { pattern: /\bpowermac\b/, context: /\b(?:mac|macaroni|cheese)\b/ },
  { pattern: /\blitl smokies\b/, context: /\bsausage\b/ },
  { pattern: /\begg white\b/, context: /\b(?:breakfast|sandwich|sausage|egg)\b/ },
  { pattern: /\bprotein\b/, context: /\b(?:waffle|waffles|pancake|pancakes)\b/ },
  { pattern: /\bprotein\b/, context: /\b(?:salad|salad kit)\b/ },
  { pattern: /\b(?:flavor blasted|xtra)\b/, context: /\b(?:cracker|crackers|goldfish)\b/ },
  { pattern: /\bfranks redhot\b/, context: /\b(?:cracker|crackers|goldfish)\b/ },
  { pattern: /\brefill\b/, context: /\b(?:oil|drizzle|bottle|pouch)\b/ },
  { pattern: /\bbig cup\b/, context: /\b(?:reeses|peanut butter cup|peanut butter cups)\b/ },
  { pattern: /\bcheesecake\b/, context: /\b(?:yogurt|dairy)\b/ },
  { pattern: /\bcheesecake\b/, context: /\b(?:pop tarts|toaster pastr(?:y|ies))\b/ },
  { pattern: /\boatmilk\b/, context: /\b(?:coffee|latte|draft)\b/ },
  { pattern: /\bsesame\b/, context: /\b(?:bun|buns|roll|rolls)\b/ },
  { pattern: /\b(?:zesty|robusto)\b/, context: /\b(?:dressing|sauce)\b/ },
  { pattern: /\bpolynesian\b/, context: /\bsauce\b/ },
  { pattern: /\bchunky\b/, context: /\bchili\b/ },
  { pattern: /\bfat free\b/, context: /\b(?:condensed milk|evaporated milk)\b/ },
  { pattern: /\byellow corn\b/, context: /\btortillas?\b/ },
  { pattern: /\bsmoked\b/, context: /\bpaprika\b/ },
  { pattern: /\bfinely\b/, context: /\b(?:chopped|tomato|tomatoes)\b/ },
  { pattern: /\bfinely\b/, context: /\b(?:shredded|shreds)\b.*\b(?:cheese|cheddar)\b|\b(?:cheese|cheddar)\b.*\b(?:shredded|shreds)\b/ },
  { pattern: /\bthick cut\b/, context: /\b(?:shredded|shreds)\b.*\b(?:cheese|cheddar)\b|\b(?:cheese|cheddar)\b.*\b(?:shredded|shreds)\b/ },
  { pattern: /\bfarmstyle\b/, context: /\b(?:cheese|cheddar|shredded)\b/ },
  { pattern: /\bwhite corn\b/, context: /\b(?:grits|polenta|cornmeal)\b/ },
  { pattern: /\bbisque\b/, context: /\bsoup\b/ },
  { pattern: /\bhoney\b/, context: /\b(?:corn muffin|cornbread)\b/ },
  { pattern: /\bkids\b/, context: /\b(?:milk|beverage|drink)\b/ },
  { pattern: /\boutdoor\b/, context: /\b(?:bun|buns|roll|rolls)\b/ },
  { pattern: /\bcheesy\b/, context: /\b(?:casserole|potatoes|scalloped)\b/ },
  { pattern: /\bvegetarian\b/, context: /\b(?:cheese|parmesan)\b/ },
  { pattern: /\b(?:chicken|turkey)\b/, context: /\bsausage\b/ },
  { pattern: /\bbeef\b/, context: /\bbologna\b/ },
  { pattern: /\bextra creamy\b/, context: /\b(?:milk|almondmilk|oatmilk|soymilk|coconutmilk|creamer)\b/ },
  { pattern: /\bshelf stable\b/, context: /\b(?:milk|almondmilk|oatmilk|soymilk|coconutmilk|creamer)\b/ },
  { pattern: /\bspicy\b/, context: /\b(?:dip|queso)\b/ },
  { pattern: /\bbutter\b/, context: /\bpopcorn\b/ },
  { pattern: /\bchip\b/, context: /\bice cream\b/ },
  { pattern: /\bdill\b/, context: /\b(?:tartar|sauce)\b/ },
  { pattern: /\bturkey\b/, context: /\bchili\b/ },
  { pattern: /\b(?:baconator|bacon)\b/, context: /\bchili\b/ },
  { pattern: /\bbutter chicken\b/, context: /\b(?:broth|stock)\b/ },
  { pattern: /\bgreen\b/, context: /\bolives?\b/ },
  { pattern: /\btoffee\b/, context: /\bchocolate\b/ },
  { pattern: /\bmexican style\b/, context: /\bsour cream\b/ },
  { pattern: /\bbuttermilk\b/, context: /\b(?:ranch|dressing)\b/ },
  { pattern: /\b(?:barbeque|barbecue|bbq)\b/, context: /\bchick fil a\b|\bchickfila\b/ },
  { pattern: /\beucalyptus\b/, context: /\b(?:tea|throat coat)\b/ },
  { pattern: /\beaters digest\b/, context: /\btea\b|\bpeppermint\b/ },
  { pattern: /\bmilkshake\b/, context: /\bpop tarts\b/ },
  { pattern: /\bin water\b/, context: /\b(?:tuna|fish)\b/ },
  { pattern: /\bthick\b/, context: /\b(?:bbq|barbecue)\s+sauce\b/ },
  { pattern: /\bcarbonara\b/, context: /\bsauce\b/ },
  { pattern: /\bcalcium\b/, context: /\b(?:juice|cocktail)\b/ },
  { pattern: /\bfrench vanilla\b/, context: /\b(?:pudding|yogurt|ice cream|creamer)\b/ },
  { pattern: /\boatmeal\b/, context: /\b(?:cookie|cookies|cookie mix)\b/ },
  { pattern: /\blite\b/, context: /\bsyrup\b/ },
  { pattern: /\btomato\b/, context: /\bbouillon\b/ },
  { pattern: /\bsausage\b/, context: /\bgravy\b/ },
  { pattern: /\bhawaiian\b/, context: /\b(?:bun|buns|roll|rolls)\b/ },
  { pattern: /\bcolorful\b/, context: /\bsweet potatoes\b/ },
  { pattern: /\bmezzi\b/, context: /\b(?:pasta|rigatoni)\b/ },
  { pattern: /\bcaffeine free\b/, context: /\b(?:cola|soda|drink|beverage)\b/ },
  { pattern: /\bjelly\b/, context: /\b(?:bar|bars|peanut butter)\b/ },
  { pattern: /\bbaja\b/, context: /\b(?:mountain dew|soda)\b/ },
  { pattern: /\bextra\b/, context: /\bnighty night\b/ },
  { pattern: /\bspicy\b/, context: /\b(?:seed|seeds|nuts)\b/ },
  { pattern: /\bbutter recipe\b/, context: /\b(?:cake|cake mix)\b/ },
  { pattern: /\bmini\b/, context: /\bmarshmallows?\b/ },
  { pattern: /\b(?:vegetable oil|in oil)\b/, context: /\b(?:tuna|fish)\b/ },
  { pattern: /\bspicy\b/, context: /\b(?:tuna|fish|albacore|skipjack)\b/ },
  { pattern: /\bgourmet\b/, context: /\b(?:tuna|fish|albacore|skipjack)\b/ },
  { pattern: /\bextra\b/, context: /\b(?:sleepytime|tea)\b/ },
  { pattern: /\bspring\b/, context: /\b(?:funfetti|cake mix)\b/ },
  { pattern: /\bwhole grain\b/, context: /\benglish muffins?\b/ },
  { pattern: /\bcoleslaw\b/, context: /\b(?:ranch|dressing)\b/ },
  { pattern: /\bslightly sweet\b/, context: /\btea\b/ },
  { pattern: /\bcookie dough\b/, context: /\bice cream\b/ },
  { pattern: /\bsimply\b/, context: /\b(?:gelatin|jell o)\b/ },
  { pattern: /\bmild\b/, context: /\b(?:buffalo|wing)\s+sauce\b/ },
  { pattern: /\bhomemade\b/, context: /\b(?:ice cream|vanilla)\b/ },
  { pattern: /\boat\b/, context: /\b(?:latte|coffee drink)\b/ },
  { pattern: /\bmint\b/, context: /\b(?:tea|licorice)\b/ },
  { pattern: /\bmushroom\b/, context: /\b(?:soup|barley)\b/ },
  { pattern: /\bmushroom\b/, context: /\bpot pie\b/ },
  { pattern: /\bhoneycrisp\b/, context: /\b(?:apple|juice)\b/ },
  { pattern: /\bground pepper\b/, context: /\b(?:chip|chips|crisp|crisps)\b/ },
  { pattern: /\bprobiotic\b/, context: /\btea\b/ },
  { pattern: /\bstring cheese\b/, context: /\b(?:cheese|mozzarella)\b/ },
  { pattern: /\bsmoked\b/, context: /\b(?:cheese|mozzarella)\b/ },
  { pattern: /\bcheese\b/, context: /\b(?:jerky|meat)\s+sticks?\b|\bsticks?\b.*\b(?:jerky|meat|beef|turkey|pork)\b/ },
  { pattern: /\bbitches brew\b/, context: /\b(?:coffee|cold brew|nitro)\b/ },
  { pattern: /\b(?:double belgian|belgian)\b/, context: /\b(?:ice cream|chocolate)\b/ },
  { pattern: /\bbomba\b/, context: /\b(?:rice|paella)\b/ },
  { pattern: /\bpremium select\b/, context: /\b(?:olive oil|evoo)\b/ },
];

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
    "extra virgin olive oil",
    "premium select",
    "california grown",
    "everyday",
    "early harvest",
    "bright and peppery",
    "fruity",
    "olive oil",
    "vegetable oil",
    "in water",
    "honey cayenne",
    "wellness cleanse",
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
  const combinedText = `${leftText} ${rightText}`;
  const unmatchedCountLooksLikeMultipack = Boolean(
    (leftPack || rightPack)
    && !(leftPack && rightPack)
    && /\b(?:bar|bars|chip|chips|crisp|crisps|popcorn|snack|single serve|stick|sticks|water|soda|beverage|drink|kombucha|pilaf|rice mix)\b/.test(combinedText),
  );
  const packConflict = leftPack && rightPack
    ? leftPack.count !== rightPack.count
    : leftPack?.kind === "pack"
      || rightPack?.kind === "pack"
      || unmatchedCountLooksLikeMultipack;
  const conflicts = [
    Boolean(packConflict),
    stateConflict(leftText, rightText, states("unsalted", "salted")),
    stateConflict(leftText, rightText, states("unsweetened", "sweetened")),
    stateConflict(leftText, rightText, states("decaf", "caffeinated"), /\b(?:coffee|tea)\b/),
    stateClaimConflict(
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
    stateClaimConflict(
      leftText,
      rightText,
      states("extra firm", "medium firm", "firm", "soft", "silken"),
      /\btofu\b/,
    ),
    stateClaimConflict(
      leftText,
      rightText,
      states("extra large", "large", "medium", "small"),
      /\beggs?\b/,
    ),
    stateConflict(
      leftText,
      rightText,
      states("tikka masala", "butter chicken", "chicken biryani", "biryani", "korma", "saag paneer"),
      /\b(?:indian|chicken|meal|biryani|korma|paneer)\b/,
    ),
    stateClaimConflict(leftText, rightText, states("chicken", "beef", "vegetable", "mushroom"), /\b(?:broth|stock)\b/),
    stateConflict(leftText, rightText, states("broth", "stock"), /\b(?:broth|stock)\b/),
    stateClaimConflict(
      leftText,
      rightText,
      aliases([
        ["extra virgin olive oil", "olive oil"],
        ["olive oil", "olive oil"],
        ["vegetable oil", "vegetable oil"],
        ["in water", "water"],
      ]),
      /\b(?:tuna|fish|albacore|skipjack)\b/,
    ),
    stateClaimConflict(
      leftText,
      rightText,
      aliases([
        ["california grown", "california grown"],
        ["everyday", "everyday"],
        ["early harvest", "early harvest"],
        ["bright and peppery", "early harvest"],
        ["fruity", "fruity"],
      ]),
      /\b(?:olive oil|evoo)\b/,
    ),
    stateClaimConflict(
      leftText,
      rightText,
      states("olive oil", "avocado oil", "coconut oil", "canola oil"),
      /\b(?:cooking spray|non stick spray|nonstick spray)\b/,
    ),
    stateClaimConflict(
      leftText,
      rightText,
      states("probiotic", "digestion"),
      /\b(?:wellness shot|juice shot|shot)\b/,
    ),
    stateConflict(
      leftText,
      rightText,
      states("solid", "chunk", "flake"),
      /\b(?:tuna|fish|albacore|skipjack)\b/,
    ),
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
    stateClaimConflict(
      leftText,
      rightText,
      states("dark chocolate", "milk chocolate", "white chocolate"),
      /\bchocolate\b/,
    ),
    stateClaimConflict(
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
    stateClaimConflict(
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
        ["american cheese", "american"],
        ["american", "american"],
        ["bleu cheese", "bleu"],
        ["blue cheese", "bleu"],
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
    stateClaimConflict(
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
    stateClaimConflict(
      leftText,
      rightText,
      aliases([
        ["diced tomatoes", "diced tomatoes"],
        ["tomatoes diced", "diced tomatoes"],
        ["crushed tomatoes", "crushed tomatoes"],
        ["tomatoes crushed", "crushed tomatoes"],
        ["whole peeled tomatoes", "whole peeled tomatoes"],
        ["peeled whole tomatoes", "whole peeled tomatoes"],
        ["tomatoes whole peeled", "whole peeled tomatoes"],
        ["tomato sauce", "tomato sauce"],
        ["tomato paste", "tomato paste"],
      ]),
      /\btomato(?:es)?\b/,
    ),
    stateClaimConflict(
      leftText,
      rightText,
      aliases([
        ["english", "english"],
        ["seedless", "english"],
      ]),
      /\bcucumbers?\b/,
    ),
    presenceConflict(leftText, rightText, /\bfire roasted\b/, /\btomato(?:es)?\b/),
    presenceConflict(leftText, rightText, /\bpetite\b/, /\btomato(?:es)?\b/),
    presenceConflict(leftText, rightText, /\bbasil\b/, /\b(?:soup|sauce|tomato(?:es)?)\b/),
    presenceConflict(
      leftText,
      rightText,
      /\bgreen chil(?:e|i)(?:s|es)?\b/,
      /\b(?:enchilada|salsa|sauce|tomato(?:es)?)\b/,
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
        ["salt and ground pepper", "salt and pepper"],
        ["ground pepper", "salt and pepper"],
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
      aliases([
        ["buttermilk", "buttermilk"],
        ["buckwheat", "buckwheat"],
        ["protein", "protein"],
        ["classic", "original"],
        ["original", "original"],
      ]),
      /\b(?:pancake|waffle)\b/,
    ),
    stateClaimConflict(
      leftText,
      rightText,
      states("star", "bunny"),
      /\b(?:pasta|soup)\b/,
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
    stateClaimConflict(
      leftText,
      rightText,
      states("mild", "medium", "hot"),
      /\b(?:chiles?|chilis?|chilies|jalapenos?|enchilada|salsa)\b/,
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
    stateClaimConflict(
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
        ["butter crunch", "butter crunch"],
        ["snickerdoodle", "snickerdoodle"],
        ["cinnamon", "cinnamon"],
        ["rosemary", "rosemary"],
        ["cracked pepper", "cracked pepper"],
        ["dill pickle", "dill pickle"],
        ["jalapeno", "jalapeno"],
        ["fig", "fig"],
        ["key lime", "key lime"],
        ["almond", "almond"],
        ["almonds", "almond"],
        ["cashew", "cashew"],
        ["hazelnut", "hazelnut"],
        ["peanut", "peanut"],
        ["peanut butter", "peanut butter"],
        ["walnut", "walnut"],
        ["chocolate", "chocolate"],
        ["vanilla", "vanilla"],
        ["honey", "honey"],
        ["garlic", "garlic"],
        ["ginger", "ginger"],
        ["chipotle", "chipotle"],
        ["basil", "basil"],
        ["pear", "pear"],
        ["black cherry", "black cherry"],
        ["echinacea", "echinacea"],
        ["lavender", "lavender"],
        ["cranberry", "cranberry"],
        ["pomegranate", "pomegranate"],
        ["hibiscus", "hibiscus"],
        ["turmeric", "turmeric"],
        ["sesame", "sesame"],
        ["double chocolate", "double chocolate"],
        ["vanilla bean", "vanilla bean"],
        ["smoky", "smoky"],
        ["mint", "mint"],
        ["milk and cookies", "milk and cookies"],
        ["birthday cake", "birthday cake"],
        ["neapolitan", "neapolitan"],
        ["summer berry", "summer berry"],
        ["smores", "smores"],
        ["cookies and cream", "cookies and cream"],
        ["peanut butter cup", "peanut butter cup"],
        ["peanut butter half baked", "peanut butter half baked"],
        ["chocolate peanut butter split", "chocolate peanut butter split"],
        ["pumpkin spice", "pumpkin spice"],
        ["caramel", "caramel"],
        ["raisins", "raisin"],
        ["mixed berry", "mixed berry"],
        ["very berry", "very berry"],
        ["bbq", "barbecue"],
        ["barbecue", "barbecue"],
        ["barbeque", "barbecue"],
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
    stateClaimConflict(
      leftText,
      rightText,
      aliases([
        ["black", "black"],
        ["black beans", "black"],
        ["black bean", "black"],
        ["white", "white"],
        ["white beans", "white"],
        ["white bean", "white"],
        ["pinto", "pinto"],
        ["pinto beans", "pinto"],
        ["pinto bean", "pinto"],
        ["kidney", "kidney"],
        ["kidney beans", "kidney"],
        ["kidney bean", "kidney"],
        ["cannellini", "cannellini"],
        ["cannellini beans", "cannellini"],
        ["cannellini bean", "cannellini"],
        ["garbanzo", "garbanzo"],
        ["garbanzo beans", "garbanzo"],
        ["garbanzo bean", "garbanzo"],
        ["chickpeas", "garbanzo"],
        ["chickpea", "garbanzo"],
        ["navy beans", "navy"],
        ["navy bean", "navy"],
        ["great northern beans", "great northern"],
        ["great northern bean", "great northern"],
      ]),
      /\bbeans?\b/,
    ),
    stateConflict(
      leftText,
      rightText,
      states("ball", "perline"),
      /\bmozzarella\b/,
    ),
    stateConflict(
      leftText,
      rightText,
      aliases([
        ["ciliegine", "ciliegine"],
        ["pearls", "pearls"],
        ["perline", "pearls"],
        ["ball", "ball"],
        ["log", "log"],
      ]),
      /\bmozzarella\b/,
    ),
    stateClaimConflict(
      leftText,
      rightText,
      aliases([
        ["baby spinach", "spinach"],
        ["spinach", "spinach"],
        ["baby arugula", "arugula"],
        ["arugula", "arugula"],
        ["spring mix", "spring mix"],
        ["supergreens", "supergreens"],
      ]),
      /\b(?:salad|greens?|spinach|arugula|spring mix)\b/,
    ),
    stateClaimConflict(
      leftText,
      rightText,
      states("original", "natural", "creamy"),
      /\b(?:sunbutter|sunflower seed butter|sunflower butter)\b/,
    ),
    stateClaimConflict(
      leftText,
      rightText,
      states("caesar supreme", "chopped caesar"),
      /\b(?:caesar|salad kit)\b/,
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
    ...asymmetricVariantGuards.map(({ pattern, context }) => (
      presenceConflict(leftText, rightText, pattern, context)
    )),
  ];
  return !conflicts.some(Boolean);
}
