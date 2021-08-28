const express = require('express')
const fs = require('fs');
const app = express();
const port = 8000;
const exec = require('child_process').exec;
const execSync = require("child_process").execSync;
const spawnSync = require("child_process").spawnSync;
const configFile = './config.json';
const multer = require("multer");
const unzipper = require('unzipper');

app.set('view engine', 'hbs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));


app.get('/login', (req, res) => {
  res.render('login')
});

app.post('/login', (req, res) => {

  var config = JSON.parse(fs.readFileSync(configFile));
  var body = {
    user: req.body.user,
    password: req.body.password
  };

  if (body.user == config.credential.user
    && body.password == config.credential.password) {
    res.write('Correct');
  } else {
    res.redirect('/login');
  }
  res.end();

});

app.get('/', (req, res) => {


  const apps = getAppList();
  res.render('index', {
    apps: apps
  });
});

app.post('/install-node-module', (req, res) => {
  var body = {
    app: req.body.app
  };
  const cmd = 'cd apps/' + body.app + ' && npm install';
  execSync(cmd);
  return res.redirect('/');

});

app.post('/start', (req, res) => {

  var body = {
    app: req.body.app
  };
  var app = findAppConfig(body.app);
  const cmd = 'cd apps/' + body.app + ' && pm2 start ' + app.start_file + ' --name ' + app.name;
  console.log(cmd);

  execSync(cmd);
  return res.redirect('/');

});

app.post('/restart', (req, res) => {

  var body = {
    app: req.body.app
  };
  var app = findAppConfig(body.app);
  var cmd = 'pm2 delete '+ app.name;
  console.log(cmd);

  execSync(cmd);
  cmd = 'cd apps/' + body.app + ' && pm2 start ' + app.start_file + ' --name ' + app.name;
  console.log(cmd);

  execSync(cmd);
  return res.redirect('/');

});

app.post('/stop', (req, res) => {

  var body = {
    app: req.body.app
  };
  var app = findAppConfig(body.app);
  const cmd = 'pm2 stop ' + app.name;
  console.log(cmd);
  execSync(cmd);
  return res.redirect('/');

});

app.post('/save-setup', (req, res) => {

  var body = {
    app: req.body.app,
    package_json: req.body.package_json,
    start_file: req.body.start_file
  };
  console.log({ body });
  var config = JSON.parse(fs.readFileSync(configFile));
  for (var i = 0; i < config.apps.length; i++) {
    var app = config.apps[i];
    if (body.app == app.name) {
      app.start_file = body.start_file;
    }
  }
  fs.writeFileSync(configFile, JSON.stringify(config, null, '    '));

  return res.redirect('/');

});


function findAppConfig(appName) {
  var config = JSON.parse(fs.readFileSync(configFile));
  for (var i = 0; i < config.apps.length; i++) {
    var app = config.apps[i];
    if (app.name == appName) {
      return app;
    }
  }
  return null;
}

function synchPm2Status(apps) {

  var config = JSON.parse(fs.readFileSync(configFile));

  var command = 'pm2 jlist';
  var stdout = execSync(command);
  const response = JSON.parse(stdout);

  for (var i = 0; i < apps.length; i++) {
    var found = false;
    var app = apps[i];

    for (var j = 0; j < response.length; j++) {
      var process = response[j];
      if (app.name == process.name) {
        app.pid = process.pid;
        app.internal_port = findPortByPid(process.pid);
        app.status = process.pm2_env.status;
        found = true;
        break;
      }
    }
    console.log({ found });
    if (found == false) {
      app.pid = null;
      app.internal_port = null;
    }

    found = false;

    for (var j = 0; j < config.apps.length; j++) {
      var configApp = config.apps[j];
      if (app.name == configApp.name) {
        app.start_file = configApp.start_file;
        found = true;
        break;
      }
    }
    console.log({ found });
    if (found == false) {
      app.start_file = null;
    }
    apps[i] = app;
  }
  config.apps = apps;
  console.log({ config: JSON.stringify(config) });
  fs.writeFileSync(configFile, JSON.stringify(config, null, '    '));
}

function findPortByPid(pid) {
  try {
    var command = 'ss -l -p -n | grep "pid=' + pid + ',"';
    var stdout = execSync(command);
    var reponse = stdout.toString('utf8');
    console.log({ reponse });

    var arr = reponse.split(' ');
    arr = removeBlankFromArray(arr);
    var portPart = arr[4];
    console.log({ portPart });
    var portPartSplit = portPart.split(':');
    var port = portPartSplit[portPartSplit.length - 1];
    return port;
  } catch {
    console.log('here');
    return null;
  }

}

function removeBlankFromArray(arr) {
  console.log(arr);
  var newArray = [];
  for (var i = 0; i < arr.length; i++) {
    if (arr[i] != '') {
      newArray.push(arr[i]);
    }
  }
  console.log({ newArray });
  return newArray;
}

function getAppList() {
  var apps = [];
  const dirs = getDirectories('apps');
  for (var i = 0; i < dirs.length; i++) {
    apps.push({
      name: dirs[i],
      start_file: null,
      internal_port: null,
      pid: null,
      status: "require setup"
    });
  }
  synchPm2Status(apps);

  apps = [];
  var config = JSON.parse(fs.readFileSync(configFile));
  console.log(config);

  config.apps.forEach(app => {
    if (app.start_file != null && app.status == 'require setup') {
      app.status = 'stopped';
    }
    var status_class = '';
    var show_start = false;
    var show_stop = false;
    var show_setup = false;
    if (app.status == 'online') {
      status_class = 'badge-success';
      show_start = false;
      show_stop = true;
      show_setup = false;
    } else if (app.status == 'stopped') {
      status_class = 'badge-danger';
      show_start = true;
      show_stop = false;
      show_setup = false;
    } else {
      status_class = 'badge-warning';
      show_start = false;
      show_stop = true;
      show_setup = false;
    }

    if (app.status == null) {
      show_start = true;
      show_stop = false;
    }



    if (app.status == 'require setup') {
      show_setup = true;
      show_start = false;
      show_stop = false;
    }

    apps.push({
      name: app.name,
      start_file: app.start_file,
      status: app.status,
      internal_port: app.internal_port,
      pid: app.pid,
      status_class: status_class,
      show_stop: show_stop,
      show_start: show_start,
      show_setup: show_setup
    });
  });
  return apps;
}


const getDirectories = source =>
  fs.readdirSync(source, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name)



const handleError = (err, res) => {
  res
    .status(500)
    .contentType("text/plain")
    .end("Oops! Something went wrong!");
};

const upload = multer({
  dest: "uploaded"
});
app.post("/new-upload", upload.single("file"), (req, res) => {
  const tempPath = req.file.path;
  var name = req.file.originalname.toLowerCase();
  name = name.replace('.zip','');
  if (fs.existsSync('apps/'+name)) {
    fs.rmdirSync('apps/'+name, { recursive: true });
  }
  fs.createReadStream(tempPath)
  .pipe(unzipper.Extract({ path: 'apps/' }));

  return res.redirect('/');
}
);



app.listen(port, () => {
  console.log(`Nodeman listening at http://localhost:${port}`)
});


