import GroceryExplorer, { type Dataset } from "./GroceryExplorer";
import dataset from "../data/products.json";

export default function Home() {
  return <GroceryExplorer data={dataset as Dataset} />;
}
