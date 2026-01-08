require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const OpenIDConnectStrategy = require('passport-openidconnect').Strategy;
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const app = express();

// Middleware for parsing JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Set up EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Passport Strategy Configuration
passport.use('oidc', new OpenIDConnectStrategy({
    issuer: process.env.KEYCLOAK_ISSUER,
    authorizationURL: `${process.env.KEYCLOAK_ISSUER}/protocol/openid-connect/auth`,
    tokenURL: `${process.env.KEYCLOAK_ISSUER}/protocol/openid-connect/token`,
    userInfoURL: `${process.env.KEYCLOAK_ISSUER}/protocol/openid-connect/userinfo`,
    clientID: process.env.KEYCLOAK_CLIENT_ID,
    clientSecret: process.env.KEYCLOAK_CLIENT_SECRET,
    callbackURL: process.env.CALLBACK_URL,
    scope: 'openid profile email'
  }, async (issuer, profile, done) => {
    try {
      // Check if user exists in the database by Keycloak ID
      let user = await prisma.user.findUnique({
        where: { keycloakId: profile.id },
      });

      // If not found by Keycloak ID, try looking up by email (userName)
      // This allows users pre-provisioned via SCIM to log in
      if (!user) {
        const email = profile.emails?.[0]?.value;
        if (email) {
          user = await prisma.user.findUnique({
            where: { userName: email },
          });
        }
      }

      // If user not found, reject login
      if (!user) {
        console.warn(`Login rejected: User ${profile.displayName} (${profile.emails?.[0]?.value}) not found in database.`);
        return done(null, false, { message: 'User not authorized. Please contact your administrator.' });
      }

      // If user is inactive, reject login
      if (user.active === false) {
        console.warn(`Login rejected: User ${user.userName} is inactive.`);
        return done(null, false, { message: 'User account is inactive.' });
      }

      // Sync existing user with latest info from Keycloak and ensure keycloakId is set
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          keycloakId: profile.id,
          email: profile.emails?.[0]?.value,
          name: profile.displayName,
        },
      });
      
      // Attach the database user object to the profile
      profile.dbUser = user;
      return done(null, profile);
    } catch (err) {
      return done(err);
    }
  }
));

// Serialization
passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((obj, done) => {
  done(null, obj);
});

// Import SCIM routes
const scimRoutes = require('./routes/scim');

// Middleware to check if user is authenticated
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/login');
}

// Routes
app.get('/', (req, res) => {
  res.render('index', { user: req.user });
});

// SCIM routes
app.use('/scim/v2', scimRoutes);

app.get('/login', passport.authenticate('oidc'));

app.get('/callback', 
  passport.authenticate('oidc', { failureRedirect: '/' }),
  (req, res) => {
    res.redirect('/profile');
  }
);

app.get('/profile', ensureAuthenticated, (req, res) => {
  res.render('profile', { user: req.user });
});

app.get('/logout', (req, res) => {
  req.logout((err) => {
    if (err) { return next(err); }
    // Optional: Redirect to Keycloak logout endpoint
    const logoutUrl = `${process.env.KEYCLOAK_ISSUER}/protocol/openid-connect/logout?client_id=${process.env.KEYCLOAK_CLIENT_ID}&post_logout_redirect_uri=${encodeURIComponent('http://localhost:' + process.env.PORT)}`;
    res.redirect(logoutUrl);
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server started on http://localhost:${PORT}`);
});
