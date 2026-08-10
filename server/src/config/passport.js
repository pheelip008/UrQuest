const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const prisma = require('../../prisma/prisma');

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails[0].value;
      let user = await prisma.user.findUnique({
        where: { email }
      });

      if (!user) {
        // Create new user from Google profile
        // Generate a username from display name
        const baseUsername = profile.displayName.toLowerCase().replace(/\s+/g, '_');
        let username = baseUsername;
        let counter = 1;

        // Ensure username is unique
        while (await prisma.user.findUnique({ where: { username } })) {
          username = `${baseUsername}_${counter}`;
          counter++;
        }

        user = await prisma.user.create({
          data: {
            username,
            email,
            profilePicture: profile.photos?.[0]?.value || null,
            provider: 'google'
          }
        });
      } else {
        // Update profile picture if missing
        if (!user.profilePicture && profile.photos?.[0]?.value) {
          user = await prisma.user.update({
            where: { id: user.id },
            data: { profilePicture: profile.photos[0].value }
          });
        }
      }

      done(null, user);
    } catch (error) {
      done(error, null);
    }
  }
));

module.exports = passport;
