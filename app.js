#!/usr/bin/node
var app_root = __dirname,
    express = require('express'),
    path = require('path');
    mongojs = require('mongojs'),
    crypto = require('crypto');

var collections = ["users", "subjects"],
    db = mongojs.connect('mydb', collections),
    ObjectId = mongojs.ObjectId;
    

var app = express();

app.configure(function() {
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(path.join(app_root, 'public')));
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});


/*
Execute an action as agent

> req - request having agent's session key in params.key
> res - response holder
> action(req, res, agent) - function to execute
*/
function authorized(req, res, action) {
  if (!req.params.key) {
    return res.send({ code: 400, message: "Authorization key was not supplied" });
  }
  db.users.findOne({ token: req.params.key }, function(err, agent) {
    if (err) {
      return res.send(500, { code: 500, message: "Error getting user", reason: err });
    }
    if (!agent) {
      return res.send(400, { code: 400, message: "No such account" });
    }
    action(req, res, agent);
  });
};


/*
Just ensure the service is up
*/
app.get('/api', function(req, res) {
  db.users.find({ role: 'director' }, function(err, users) {
    if (err) {
      return res.send(500, { code: 500, message: "Error accessing MongoDB database", reason: err });
    }
    // Initialize the db with director account
    if (users.size == 0) {
      db.users.save({ name: 'boss', password: '0', role: 'director' }, function(err, director) {
        if (err) {
          return res.send(500, { code: 500, message: "Error initializing database", reason: err });
        }
        return res.send({ code: 200, message: "Director account was created for you. You can change password later", account: director });
      });
    }
  });
  res.send('API is running');
});


/*
Start session

> :name - acount login
> :password - account password
< id - account id
< key - session key
*/
app.get('/api/login/:name/:password', function(req, res) {
  db.users.findOne({ name: req.params.name, password: req.params.password }, function(err, user) {
    if (err) {
      return res.send(500, { code: 500, message: "Error logging in", reason: err });
    }
    if (!user) {
      return res.send(400, { code: 400, message: "Invalid login/password" });
    }
    crypto.randomBytes(48, function(ex, buf) {
      token = buf.toString('hex');
      user.token = token;
      db.users.save(user, function(err, result) {
        if (err) {
          return res.send(400, { code: 400, message: "Error openenig session", reason: err });
        } else {
          return res.send({ id: user.id, token: token });
        }
      });
    });
  });
});


/*
Update account profile
> old_password - old password
> new_password - new password (optional)
*/
app.put('/api/:key/profile', function(req, res) {
  authorized(req, res, function(req, res, agent) {
    if (!req.body.old_password) {
      return res.send(400, { code: 400, message: "Parameter was not found: old_password" });
    }
    if (agent.password != req.body.old_password) {
      return res.send(400, { code: 400, message: "Incorrect old_password value" });
    }
    agent.password = req.body.new_password;
    db.users.save(agent, function(err, record) {
      if (err) {
        return res.send(500, { code: 500, message: "Error updating your profile", reason: err });
      }
      return res.send({ code: 200, message: "Profile was updated" });
    });
  });
});


/*
Close session

> :key - session key
*/
app.post('/api/:key/logout', function(req, res) {
  authorized(req, res, function(req, res, agent) {
    agent.token = null;
    db.users.save(agent, function(ex, result) {
      if (ex) {
        return res.send(500, { code: 500, message: "Error closing session" });
      } else {
        return res.send('');
      }
    });
  });
});


app.get('/api/:key/teachers', function(req, res) {
  authorized(req, res, function(req, res) {
    db.users.find({ role: 'teacher' }, function(err, users) {
      if (err) {
        return res.send(500, { code: 500, message: "Error getting teachers", reason: err });
      }
      list = [];
      users.forEach(function(user) {
        list.push({ name: user.name, _id: user._id });
      });
      return res.send(list);
    });
  });
});


app.get('/api/:key/teachers/:id', function(req, res) {
  authorized(req, res, function(req, res) {
    id = new ObjectId(req.params.id); 
    db.users.findOne({ _id: id, role: 'teacher' }, function(err, teacher) {
      if (err) {
        return res.send(500, { code: 500, message: "Error getting teacher", reason: err });
      }
      db.users.find({ role: 'student', teacher: id }, function(err, students) {
        list = [];
        students.forEach(function(student) {
          list.push({ name: student.name, _id: student._id });
        });
        return res.send({ name: teacher.name, id: teacher._id, students: list });
      });
    });
  });
});


app.get('/api/:key/students', function(req, res) {
  authorized(req, res, function(req, res) {
    db.users.find({ role: 'student' }, function(err, users) {
      if (err) {
        return res.send(500, { code: 500, message: "Error getting records", reason: err });
      }
      list = [];
      users.forEach(function(user) {
        list.push({ name: user.name, _id: user._id, teacher: user.teacher });
      });
      res.send(list);
    });
  });
});


app.get('/api/:key/directors', function(req, res) {
  authorized(req, res, function(req, res) {
    db.users.find({ role: 'director' }, function(err, users) {
      if (err) {
        return res.send(500, { code: 500, message: "Error getting records", reason: err });
      }
      list = [];
      users.forEach(function(user) {
        list.push({ name: user.name, _id: user._id });
      });
      res.send(list);
    });
  });
});


/*
Add a new user

> :key - session key
> name - account login
> password - account password
> role - account role
< id - id of just created account
*/
app.post('/api/:key/user', function (req, res) {
  authorized(req, res, function(req, res, agent) { 
    var newUser = { name: req.body.name, password: req.body.password, role: req.body.role };
    switch (agent.role) {
      case 'director':
        if (req.body.role != 'director' && req.body.role != 'teacher') {
          return res.send(400, { code: 400, message: "Insufficest privileges" });
        }
        break;
      case 'teacher':
        if (req.body.role != 'student') {
          return res.send(400, { code: 400, message: "Insufficest privileges" });
        }
        newUser.teacher = agent._id;
        break;
      case 'student':
        return res.send(400, { code: 400, message: "Insufficest privileges" });
    } 

    db.users.save(newUser, { safe: true }, function(err, record) {
      if (err) {
        return res.send(500, { code: 500, message: "Error saving record", reason: err });
      } else {
        console.log("Created user ", record);
        return res.send(record._id);
      }
    });
  });
});


app.listen(8080);
