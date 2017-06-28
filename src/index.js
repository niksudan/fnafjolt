const got = require('got');
const Twitter = require('twitter');
const stringSimilarity = require('string-similarity');
const pickRandom = require('pick-random');
const base64 = require('node-base64-image');

require('dotenv').config();

// Initialise the Twitter client
const client = new Twitter({
  consumer_key: process.env.API_KEY,
  consumer_secret: process.env.API_SECRET,
  access_token_key: process.env.ACCESS_KEY,
  access_token_secret: process.env.ACCESS_SECRET,
});

/**
 * Load 20 games of #fnaf
 * @return {Promise<Array>}
 */
const loadGames = () => {
  return new Promise((resolve) => {
    const games = [];
    got(process.env.GAMEJOLT_URL).then((response) => {
      const payload = JSON.parse(response.body);
      resolve(payload.payload.games.slice(0, 20));
    });
  }).catch(() => {
    resolve([]);
  });
}

/**
 * Load the last 20 tweets from @FNAFJOLT
 * @return {Promise<Array>}
 */
const loadTweets = () => {
  return new Promise((resolve) => {
    client.get('statuses/user_timeline', { screen_name: process.env.TWITTER_NAME }, (err, response) => {
      if (!err) {
        resolve(response);
      }
      resolve([]);
    });
  });
}

/**
 * Execute the script
 */
const fnafjolt = () => {
	loadTweets().then((tweets) => {
		loadGames().then((games) => {
			if (tweets.length > 0 && games.length > 0) {

				// Parse the tweeted game names from tweets
				console.log('Preparing blacklist...');
				const blacklist = [];
				tweets.forEach((tweet) => {
					const tweetRegex = /^(.+) #fnaf https:\/\/(.+)$/gi;
					const match = tweetRegex.exec(tweet.text);
					if (match && match.length > 1) {
						blacklist.push(match[1]);
					}
				});

				// Cycle through each game name and see if someting similar has been tweeted recently
				console.log('Preparing queue...');
				let queue = [];
				games.forEach((game) => {
					let eligible = true;
					blacklist.forEach((item) => {
						const similarity = stringSimilarity.compareTwoStrings(item, game.title);
						if (similarity >= process.env.COMP_THRESH) {
							eligible = false;
							return;
						}
					});
					if (eligible) {
						queue.push(game);
					}
				});

				// Pick random games to tweet about
				queue = pickRandom(queue, { count: process.env.MAX_TWEETS });
				
				// Tweet about each game
				console.log('Preparing to tweet...');
				queue.forEach((game) => {
					const image = base64.encode(game.img_thumbnail, {}, (err, imageBinary) => {
						client.post('media/upload', { media_data: imageBinary.toString('base64') }, (err, media, response) => {
							if (!err) {
								const status = {
									status: `${game.title} #fnaf`,
									media_ids: media.media_id_string,
								};
								client.post('statuses/update', status, (err, tweet, response) => {
									if (!err) {
										console.log(`Tweeted: "${status.status}"`);
									} else {
										console.log(`Tweet error: ${err.message}`);
									}
								});
							} else {
								console.log(`Media error: ${err.message}`);
							}
						});
					});
				});
			}
		});
	});
}

// Tweet!
setInterval(fnafjolt, 1000 * 60 * process.env.MINUTE_INTERVAL);
