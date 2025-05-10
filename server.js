const express = require("express");
const app = express();
const fs = require("fs");
const multer = require("multer");
const path = require("path");
const ejs = require("ejs");
const session = require("express-session");
const archiver = require("archiver");
const ADMIN_PASSWORD = 'nafijpro';
const bodyParser = require('body-parser');
const PORT = 3000;

// Set EJS as the view engine
app.set("view engine", "ejs");

// Middleware setup
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
  secret: "nafij_pro_secret_key",
  resave: false,
  saveUninitialized: true
}));

// Ensure required folders exist
["public/uploads", "public/apps", "data"].forEach(folder => {
  if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
});

// Ensure apps.json exists
if (!fs.existsSync("data/apps.json")) {
  fs.writeFileSync("data/apps.json", JSON.stringify([], null, 2));
}

// Read apps from file
const getApps = () => {
  try {
    return JSON.parse(fs.readFileSync("data/apps.json", "utf-8"));
  } catch (err) {
    console.error("Error reading apps.json:", err);
    return [];
  }
};

// Configure Multer
const storage = multer.diskStorage({
  destination: "public/uploads/",
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const safeName = (req.body.appFilename || "app").replace(/[^a-zA-Z0-9-_]/g, "");
    const uniqueSuffix = Date.now(); // or use uuid for more randomness
    cb(null, `${safeName}-${uniqueSuffix}${ext}`);
  }
});
const upload = multer({ storage });

// Admin check middleware
function isAdmin(req, res, next) {
  if (req.session && req.session.admin === true) {
    return next();
  }
  res.redirect("/admin");
}

// Routes
app.get("/admin", (req, res) => {
  res.send(`
    <form method="POST" action="/admin">
      <h2>Enter Admin Password:</h2>
      <input type="password" name="password" required />
      <button type="submit">Enter</button>
    </form>
  `);
});

app.post("/admin", (req, res) => {
  const { password } = req.body;
  if (password === "nafijpro++") {
    req.session.admin = true;
    res.redirect("/admin.html");
  } else {
    res.send("<p>Wrong password.</p><a href='/admin'>Try again</a>");
  }
});

app.get("/admin.html", isAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, "admin.html"));
});

app.get("/admin/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/admin");
  });
});

//এডমিন ২ এর জন্য কোড শুরু
// Middleware to parse form data
app.use(bodyParser.urlencoded({ extended: false }));

// Serve static files (like admin2.html if needed)
app.use(express.static(path.join(__dirname)));

// Serve login page
app.get('/admin2', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

// Handle login form
app.post('/login', (req, res) => {
  const password = req.body.password;

  if (password === ADMIN_PASSWORD) {
    res.redirect('/admin2.html');
  } else {
    res.send(`
      <h1 class="error">😹😹ভাগ ছাগল😎✅</h1>
      <a href="/admin2">Try again</a>
    `);
  }
});
//এডমিন2 এর কোড এর শেষ এখানে

// Add new app route
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

  const slug = (appFilename || appName || "app").replace(/[^a-zA-Z0-9-_]/g, "");
  const iconPath = `/uploads/${req.file.filename}`;

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
        return res.status(500).send("Failed to generate HTML file.");
      }

      fs.writeFileSync(`public/apps/${slug}.html`, html);
      res.redirect("/");
    });
  } catch (err) {
    console.error("Error saving new app:", err);
    res.status(500).send("Server error while saving the app.");
  }
});

// Homepage with all apps
app.get("/", (req, res) => {
  const apps = getApps();
  res.render("index", { topApps: apps });
});

// JSON route for view data folder
app.get('/data', (req, res) => {
  const filePath = path.join(__dirname, 'data', 'apps.json');
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error("Error reading apps.json:", err);
      return res.status(500).json({ error: "Failed to read data" });
    }
    try {
      const apps = JSON.parse(data);
      res.json(apps);
    } catch (parseErr) {
      console.error("Error parsing apps.json:", parseErr);
      res.status(500).json({ error: "Invalid JSON format" });
    }
  });
});


//delete route
// GET delete apps page
app.get('/admin/delete-apps', (req, res) => {
  const dataPath = path.join(__dirname, 'data', 'apps.json');
  fs.readFile(dataPath, 'utf8', (err, jsonData) => {
    if (err) {
      console.error("Failed to load app list:", err);
      return res.status(500).send('Failed to load app list');
    }
    const apps = JSON.parse(jsonData);
    res.render('delete-apps', { apps });
  });
});

// POST delete app
app.post('/admin/delete-app', (req, res) => {
  const filename = req.body.filename;
  const dataPath = path.join(__dirname, 'data', 'apps.json');

  fs.readFile(dataPath, 'utf8', (err, jsonData) => {
    if (err) return res.status(500).send('Failed to read data');

    let apps = JSON.parse(jsonData);
    const targetApp = apps.find(app => app.appFilename === filename);

    apps = apps.filter(app => app.appFilename !== filename);

    fs.writeFile(dataPath, JSON.stringify(apps, null, 2), err => {
      if (err) return res.status(500).send('Failed to delete app');

      // Delete static HTML page
      const htmlPath = path.join(__dirname, 'public', 'apps', `${filename}.html`);
      fs.unlink(htmlPath, () => {});

      // Delete app icon if available
      if (targetApp && targetApp.appIcon) {
        const iconFileName = path.basename(targetApp.appIcon);
        const iconPath = path.join(__dirname, 'public', 'uploads', iconFileName);
        fs.unlink(iconPath, () => {});
      }

      res.redirect('/admin/delete-apps');
    });
  });
});

//backup
app.get('/backup', (req, res) => {
  const zipFileName = `backup-${Date.now()}.zip`;
  const zipFilePath = path.join(__dirname, zipFileName);
  const output = fs.createWriteStream(zipFilePath);
  const archive = archiver('zip', { zlib: { level: 9 } });

  output.on('close', () => {
    res.download(zipFilePath, zipFileName, (err) => {
      fs.unlink(zipFilePath, () => {}); // Clean up after sending
    });
  });

  archive.on('error', err => res.status(500).send({ error: err.message }));

  archive.pipe(output);
  archive.directory('data/', 'data');
  archive.directory('public/', 'public');
  archive.finalize();
});

         
// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
