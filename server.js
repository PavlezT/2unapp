var https = require("https");
var url = require("url");
var fs = require("fs");
var config = require('./config');
var options = {
    key: fs.readFileSync('keycode/privatekey.pem'),
    cert: fs.readFileSync('keycode/certificate.pem')
}
var express = require('express');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var Users = require('./models/user');
var session = require('express-session');
var app = express();

function start(route, handle, pool, sessionStore) {
    app.use(cookieParser());
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({
        extended: true
    }));
    app.use(session({
        secret: 'You never cheat me',
        name: 'twonapp_cokie',
        store: sessionStore,
        resave: true,
        saveUninitialized: true
    }));
    app.use(passport.initialize());
    app.use(passport.session());
    app.set('view engine', 'ejs');
    passport.use('local-login', new LocalStrategy({
        usernameField: 'email',
        passwordField: 'password',
        passReqToCallback: true
    }, function(req, username, password, done) {
        pool.getConnection(function(err, connection) {
            if (err) {
                console.log("MYSQL: can't get connection from pool:", err);
                throw err;
            }
            connection.query("SELECT * FROM `users` WHERE `username` = '" + username + "'", function(err, rows) {
                if (err) {
                    return done(err);
                }
                if (!rows.length) {
                    return done(null, false); //,req.flash('loginMessage', 'No user found.')); // req.flash is the way to set flashdata using connect-flash
                }
                if (!(rows[0].password == password)) {
                    return done(null, false); //, req.flash('loginMessage', 'Oops! Wrong password.'));
                }
                return done(null, rows[0]);
            });
            connection.release();
        });
    }));
    passport.serializeUser(function(user, done) {
        //  console.log("User:" + user.id_user);
        done(null, user.id_user);
    });
    passport.deserializeUser(function(id_user, done) {
        pool.getConnection(function(err, connection) {
            if (err) {
                console.log("MYSQL: can't get connection from pool:", err);
                throw err;
            }
            connection.query("select * from users where id_user = " + id_user, function(err, rows) {
                done(err, rows[0]);
            });
            connection.release();
        });
    });
    
    app.post('/login', function(req, res, next) {
        passport.authenticate('local-login', function(err, user) {
            if (err) {
                return next(err); // will generate a 500 error
            }
            if (!user) {
                res.writeHead(400);
                res.end();
                return;
            }
            req.login(user, function(err) {
                if (err) {
                    return next(err);
                }
                return res.send({
                    success: true,
                    message: 'authentication succeeded'
                });
            });
        })(req, res, next);
    });

    function isLoggedIn(req, res, next) {
        if (req.isAuthenticated()) return next();
        res.redirect('/');
    }
    app.get('/profile',isLoggedIn, function(req, res) {
        res.render('profile.ejs', {
            user: req.user // get the user out of session and pass to template
        });
    });
    app.use(function(request, response) {
        var pathname = url.parse(request.url).pathname;
        route(fs, handle, pathname, response, request, pool);
    });
    https.createServer(options, app).listen(config.get('server_port'), config.get('server_ip'));
    console.log("Server has started at port:" + config.get("server_port") + " and ip:" + config.get("server_ip"));
}
exports.start = start;