const express = require("express");
const cors = require("cors");
const connectDb = require("./utils/db");
const path = require("path");
const apiRoutes = require("./routes/api");
require("dotenv").config();

const app = express();
const port = 3000;

connectDb();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "../public")));

app.use(express.static("public"));

app.use(
  cors({
    origin: ["http://localhost:5173"],
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.use("/api", apiRoutes);

app.listen(port, () => {
  console.log(`App listening at http://localhost:${port}`);
});
