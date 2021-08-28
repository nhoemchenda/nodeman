const express = require('express')
const fs = require('fs');
const app = express();
const port = 8000;
const exec = require('child_process').exec;
const execSync = require("child_process").execSync;
const spawnSync = require("child_process").spawnSync;
const configFile = './config.json';

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
  synchPm2Status();
  var config = JSON.parse(fs.readFileSync(configFile));

  var apps = [];
  config.apps.forEach(app => {
    var status_class = '';
    var show_start = false;
    var show_stop = false;
    if (app.status == 'online') {
      status_class = 'badge-success';
      show_start = false;
      show_stop = true;
    } else if (app.status == 'stopped') {
      status_class = 'badge-danger';
      show_start = true;
      show_stop = false;
    } else {
      status_class = 'badge-warning';
      show_start = false;
      show_stop = true;
    }

    if(app.status == null){
      show_start = true;
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
      show_start: show_start
    });
  });
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

function synchPm2Status() {
  var config = JSON.parse(fs.readFileSync(configFile));
  var command = 'pm2 jlist';

  var stdout = execSync(command);
  const response = JSON.parse(stdout);
  
  for (var i = 0; i < config.apps.length; i++) {
    var found = false;
    var app = config.apps[i];
   
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
    console.log({found});
    if(found == false){
      app.pid = null;
      app.internal_port = null;
      app.status = null;
    }
    config.apps[i] = app;
  }
  console.log({config : JSON.stringify(config)});
  fs.writeFileSync(configFile, JSON.stringify(config,null,'    '));

}

function findPortByPid(pid){
  try {
    var command = 'ss -l -p -n | grep "pid='+pid+',"';
    var stdout = execSync(command);
    var reponse =  stdout.toString('utf8');
    console.log({reponse});

    var arr = reponse.split(' ');
    arr = removeBlankFromArray(arr);
    var portPart = arr[4];
    console.log({portPart});
    var portPartSplit = portPart.split(':');
    var port = portPartSplit[portPartSplit.length-1];
    return port ;
  }catch{
    console.log('here');
    return null;
  }
  
}

function removeBlankFromArray(arr){
  console.log(arr);
  var newArray = [];
  for(var i = 0 ; i< arr.length ; i++){
    if(arr[i] != ''){
      newArray.push(arr[i]);
    }
  }
  console.log({newArray});
  return newArray;
}


app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
});


//tcp    LISTEN     0      511      :::8000                 :::*                   users:(("node /app/index",pid=19,fd=20))
//ss -l -p -n | grep "pid=1234,"