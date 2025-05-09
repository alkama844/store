const express = require("express");
const app = express();
const fs = require("fs");
const multer = require("multer");
const path = require("path");
const ejs = require("ejs");
const session = require("express-session");

const PORT = 3000;

// View engine
app.set("view engine", "ejs");

// Middleware
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
  secret: "nafij_pro_secret_key",
  resave: false,
  saveUninitialized: true
}));

// Ensure folders exist
["public/uploads", "public/apps", "data"].forEach(folder => {
  if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
});

// Check if apps.json exists, if not create it
if (!fs.existsSync("data/apps.json")) {
  const initialData = [];
  fs.writeFileSync("data/apps.json", JSON.stringify(initialData, null, 2));
}

["public/uploads", "public/apps", "data"].forEach(folder => {
  if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
});

// Get app data
const getApps = () => {
  return JSON.parse(fs.readFileSync("data/apps.json", "utf-8"));
};

// File upload setup
const storage = multer.diskStorage({
  destination: "public/uploads/",
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const safeName = req.body.appFilename.replace(/[^a-zA-Z0-9-_]/g, "");
    cb(null, `${safeName}${ext}`);
  }
});
const upload = multer({ storage });

// Middleware to check admin session
function isAdmin(req, res, next) {
  if (req.session && req.session.admin === true) {
    return next();
  }
  res.redirect("/admin");
}

// Password check page
app.get("/admin", (req, res) => {
  res.send(`
    <form method="POST" action="/admin">
      <h2>Enter Admin Password:</h2>
      <input type="password" name="password" required />
      <button type="submit">Enter</button>
    </form>
  `);
});

// Handle password submission
app.post("/admin", (req, res) => {
  const { password } = req.body;
  if (password === "nafijpro++") {
    req.session.admin = true;
    res.redirect("/admin.html");
  } else {
    res.send("<p>Wrong password.</p><a href='/admin'>Try again</a>");
  }
});

// Admin dashboard access
app.get("/admin.html", isAdmin, (req, res) => {
  res.sendFile(__dirname + "/admin.html");
});

// Admin logout
app.get("/admin/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/admin");
});

// Add new app
app.post("/admin/add-app", isAdmin, upload.single("appIcon"), (req, res) => {
  const {
    appName,
    appDescription,
    appCategory,
    appLink,
    appDownloads,
    appFilename
  } = req.body;

  if (!req.file) {
    return res.status(400).send("App icon is required.");
  }

  const iconPath = `/uploads/${req.file.filename}`;
  const slug = appFilename.replace(/[^a-zA-Z0-9-_]/g, "");

  const newApp = {
    appName,
    appDescription,
    appCategory,
    appLink,
    appDownloads,
    appFilename: slug,
    appIcon: iconPath
  };

  try {
    const apps = getApps();
    apps.push(newApp);
    fs.writeFileSync("data/apps.json", JSON.stringify(apps, null, 2));

    ejs.renderFile("views/template.ejs", newApp, (err, html) => {
      if (err) {
        console.error("EJS render error:", err);
        return res.status(500).send("Error generating app page");
      }

      fs.writeFileSync(`public/apps/${slug}.html`, html);
      res.redirect("/");
    });
  } catch (err) {
    console.error("Add-app crash:", err);
    res.status(500).send("Something went wrong while saving the app.");
  }
});

// Homepage route
app.get("/", (req, res) => {
  const apps = getApps();
  res.render("index", { topApps: apps });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
