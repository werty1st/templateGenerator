var fs = require('fs');
var request = require("request");
var log = require('npmlog');


log.heading = 'HSMRS';
log.level = 'silent';
//log.level = 'debug';
log.level = 'info';
// log.verbose('verbose prefix', 'x = %j', {foo:{bar:'baz'}})
// log.info('info prefix', 'x = %j', {foo:{bar:'baz'}})
// log.warn('warn prefix', 'x = %j', {foo:{bar:'baz'}})
// log.error('error prefix', 'x = %j', {foo:{bar:'baz'}})

var express = require('express');
var app = express();
    app.enable('trust proxy');


var server = app.listen(process.env.PORT || 3000, function() {
    console.log('Listening on port %d', server.address().port);
});

var maxPosts = 10;
var maxage = 1;
var url = "http://api.massrelevance.com/ZDFM/hs-comments.json";


var posts = {};
var posts_out = {};
var open = 0;
var age = new Date();


function updatePosts(){

	age = new Date( (new Date).getTime() + maxage*60000);

	log.info("Posts loaded");
	log.verbose("reload after", age );
	posts_out = posts;
	posts = {};
}

//init fill
log.verbose("Initial run");
getPosts( updatePosts );


app.get('/', function(req, res){

	log.http("request received","version:", age );

	var old = age.valueOf();
	var now = new Date().valueOf();

	if (old <= now ){
		//outdated get new	
		log.verbose("stream outdated","reload posts");
		getPosts( updatePosts );		
	}

	res.setHeader('Cache-Control', 'no-chache,no-store');
	res.setHeader('Edge-Control', 'public, max-age=' + maxage * 60);
	res.setHeader('X-Next-Refresh', age);
	posts_out = Object.keys(posts_out).map(function (key) {return posts_out[key]});
	res.send(posts_out);
  
});



function getPosts( callback ){

	request({
			    url: url,
			    json: true
			}, function (error, response, body) {

			    if (!error && response.statusCode === 200) {
			        //console.log(body) // Print the json response

			        for (var i = 0; i<body.length && i<maxPosts; i++) {
			        	var nw = body[i].network;
			        	var post = body[i];

			        	if (nw == "facebook"){
			        		addFB(post, callback, i);
			        		open++;
			        	} else if ( nw == "twitter"){
			        		addtw(post, callback, i);
			        		open++;
			        	}
			        };

			    }
			});

}

function addFB(post, callback, index){
	//get face
	//console.log("get fb face");
	
	var fburl = "http://graph.facebook.com/"+post.from.id+"/picture";
	
	log.verbose("request #"+(index+1), "facebook");


	request({
	    url: fburl,
	    encoding: null
	}, function (error, response, body) {

	    if (!error && response.statusCode === 200) {
	    	var newpost = {};

	    	log.verbose("response #"+(index+1), fburl);

	    	newpost.name 		= post.from.name;
	    	newpost.screen_name = post.from.broadcast_name;
	    	newpost.profile 	= "http://www.facebook.com/profile.php?id="+post.from.id;
	    	
	    	newpost.message 	= post.message;
	    	newpost.network 	= post.network;
	    	newpost.created_time = post.created_time;

			newpost.face = "data:" + response.headers["content-type"] + ";base64," + new Buffer(body).toString('base64');

			posts[index]=newpost;

			open--;
			if (open<=0) callback();
	    }else {
			log.warn("request #"+(index+1), "failed");
		}
	});

}


function addtw(post, callback, index){
	//console.log("get tw face")	

	var twurl = post.user.profile_image_url;
	log.verbose("request #"+(index+1), "twitter");

	request({
	    url: twurl,
	    encoding: null
	}, function (error, response, body) {

	    if (!error && response.statusCode === 200) {

	    	var newpost = {};

			log.verbose("response #"+(index+1), twurl);

	    	newpost.name 		= post.user.name;
	    	newpost.screen_name = post.user.screen_name;
	    	newpost.profile 	= "https://twitter.com/"+post.user.screen_name;
	    	
	    	newpost.message 	= post.text;
	    	newpost.network 	= post.network;
	    	newpost.created_time = new Date(post.created_at).toISOString();

			newpost.face = "data:" + response.headers["content-type"] + ";base64," + new Buffer(body).toString('base64');

			posts[index]=newpost;

			open--;
			if (open<=0) callback();

		} else {
			log.warn("request #"+(index+1), "failed");
		}
	});

}