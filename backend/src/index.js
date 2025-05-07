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

// Add this route handler:

app.get('/youtube-callback', async (req, res) => {
  try {
    const { code } = req.query;
    
    if (!code) {
      return res.status(400).send('Error: No authorization code provided');
    }

    console.log('Received YouTube auth code:', code);
    
    // Option 1: Process the code here and redirect to frontend with result
    // res.redirect(`http://localhost:5173/video-creation?youtube_auth_success=true&code=${code}`);
    
    // Option 2: Store the code temporarily and show a success page
    res.send(`
      <html>
        <body>
          <h1>Authentication Successful!</h1>
          <p>You can close this window and return to the application.</p>
          <script>
            // Send message to parent window
            window.opener && window.opener.postMessage({ 
              type: 'YOUTUBE_AUTH_SUCCESS', 
              code: '${code}' 
            }, '*');
            // Close this window after 0 seconds
            setTimeout(() => window.close(), 0);
          </script>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Error handling YouTube callback:', error);
    res.status(500).send('Authentication error');
  }
});

app.use("/api", apiRoutes);

app.listen(port, () => {
  console.log(`App listening at http://localhost:${port}`);
});
