import GroceryExplorer, { type Dataset } from "./GroceryExplorer";
import dataset from "../data/site-data.json";

export default function Home() {
  return <GroceryExplorer data={dataset as unknown as Dataset} />;
}
