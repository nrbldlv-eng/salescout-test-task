import { createApp } from "./app";

const app = createApp();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.listen(PORT, () => {
  console.log(`SaleScout repricing server running on http://localhost:${PORT}`);
});
