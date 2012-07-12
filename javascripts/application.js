jQuery(function() {
    var EVENTS = [
        'loadstart', 
        'loadedmetadata', 
        'loadeddata',
        'loadedalldata',
        'play',
        'pause',
        'timeupdate',
        'ended',
        'durationchange',
        'progress',
        'resize',
        'volumechange',
        'error',
        'fullscreenchange'
    ];

    var ERROR_CODES = {
        1: 'MEDIA_ERR_ABORTED',
        2: 'MEDIA_ERR_NETWORK',
        3: 'MEDIA_ERR_DECODE',
        4: 'MEDIA_ERR_SRC_NOT_SUPPORTED'
    };

    var SUPPORTED_VIDEO_EXTENSIONS = [
         'mp4', 'avi', 'mkv'
    ];

    var SUPPORTED_AUDIO_EXTENSIONS = [
        'mp3'
    ];

    var STATUS_MESSAGES = {
        'plugin:plugin_installed': 'plugin installed',
        'plugin:plugin_running': 'plugin running',
        'plugin:client_installed': 'client installed',
        'pairing:attempt': 'checking client port',
        //'pairing:check_version': 'checking client version',
        'plugin:client_running': 'client running',
        'pairing:attempt': 'pairing attempt',
        'pairing:found': 'pairing found',
        'client:connected': 'client connecting',
        'client:disconnected': 'client disconnected',
        'sync': 'client connected',
        'client:error': 'error',
    };

    var TRACKERS = [
        'udp://tracker.publicbt.com:80/announce',
        'http://bt.rghost.net/announce',
        'http://exodus.desync.com/announce',
        'http://tracker.ccc.de/announce',
        'http://tracker.publichd.eu/announce',
        'http://tracker.torrentbay.to:6969/announce',
        'http://tracker.yify-torrents.com/announce',
        'udp://ipv4.tracker.harry.lu:80/announce',
        'udp://tracker.ccc.de/announce',
        'udp://tracker.ccc.de:80/announce',
        'udp://tracker.djhsearch.co.cc:80/announce',
    ];    

    function isInfoHash(hash) {
        return typeof hash === 'string' && hash.length === 40;
    }

    function getMagnetLink(hash) {
        var link = 'magnet:?xt=urn:btih:' + hash;
        _.each(TRACKERS, function(tracker) {
            link += '&tr=' + tracker;
        });
        return link;
    }

    var AudioFileView = Backbone.View.extend({
        initialize: function() {
            this.template = _.template($('#audio_template').html());
            this.model.on('destroy', this.remove, this);
        },

        render: function() {
            this.$el.html(this.template({
                url: this.model.get('streaming_url'),
                name: this.model.get('name')
            }));
            new AudioJS(this.$el.find('audio')[0]);
            return this;
        }
    });

    var VideoFileView = Backbone.View.extend({
        initialize: function() {
            this.template = _.template($('#video_template').html());
            this.model.on('destroy', this.destroy, this);
        },
        destroy: function() {
            var player = _V_(this.id);
            this.unbindPlayerEvents(player);
            this.remove();
        },
        render: function() {
            this.id = 'video' + Math.floor(Math.random() * 1024);
            this.$el.html(this.template({
                name: this.model.get('name'),
                id: this.id
            }));
            _.defer(_.bind(this.ready, this));
            return this;
        },
        ready: function() {
            var player = _V_(this.id);
            player.ready(_.bind(function() {
                this.bindPlayerEvents(player);
                player.src(this.model.get('streaming_url'));
            }, this));
        },
        onPlayerEvent: function(event, data) {
            console.log(event, data);
            if(event === 'error') {
                console.log('error: ' + ERROR_CODES[data.originalEvent.currentTarget.error.code]);
                console.log('cannot play ' + this.model.get('name'));
                this.destroy();
            }
        },
        bindPlayerEvents: function(player) {
            _.each(EVENTS, function(event) {
                //player.addEvent(event, _.bind(this.onPlayerEvent, this, event));
            }, this);

            var video = this.$el.find('video')[0];
            video.addEventListener("readystatechange", function(evt) { console.log('readystatechange'); } );
            video.addEventListener("stalled", function(evt) { console.log("stalled",evt); } );
            video.addEventListener("durationchange", function(evt) { console.log('durationchange',evt); } );
            video.addEventListener("loadstart", function(evt) { console.log("load start",evt); } );
            video.addEventListener("abort", function(evt) { console.log("abort",evt); } );
            video.addEventListener("loadedmetadata", function(evt) { console.log("got metadata",evt); } );
            video.addEventListener("error", function(evt) { 
                console.log("got error", evt); 
                console.log('video state: ',video.readyState); 
            } );
            video.addEventListener("canplay", function(evt) { console.log('canplay',evt); } );
            video.addEventListener("progress", function(evt) { console.log("progress"); } );
            video.addEventListener("seek", function(evt) { console.log('seek',evt); } );
            video.addEventListener("seeked", function(evt) { console.log('seeked',evt); } );
            video.addEventListener("ended", function(evt) { console.log('ended',evt); } );
            //video.addEventListener("timeupdate", function(evt) { console.log('timeupdate',evt); } );
            video.addEventListener("pause", function(evt) { console.log('pause',evt); } );
            video.addEventListener("play", function(evt) { console.log('play',evt); } );
            video.addEventListener("suspend", function(evt) { console.log('suspend event',evt); });
        },
        unbindPlayerEvents: function(player) {
             _.each(EVENTS, function(event) {
                player.removeEvent(event, _.bind(this.onPlayerEvent, this, event));
            }, this);
        }
    });

    var InputView = Backbone.View.extend({
        initialize: function() {
            this.template = _.template($('#input_template').html());
        },
        render: function() {
            this.$el.html(this.template({
            }));
            this.$el.find('form').submit(_.bind(function(event) {
                 window.location = '#' + this.$el.find('input').val();
            }, this));
            return this;
        }
    });

    var StatusView = Backbone.View.extend({
        initialize: function() {
            this.status = 'uninitialized';
            this.model.on('all', this.update, this);
        },
        update: function(e) {
            console.log(e);
            if(e in STATUS_MESSAGES) {
                this.status = STATUS_MESSAGES[e];
                this.render();
            }
        },
        render: function() {
            $('.toolbox').text(this.status);
            return this;
        }
    });

    var link = window.location.hash.substring(1);
    console.log('link: ' + link);
    if(link) {
        //support info hashes
        if(isInfoHash(link)) {
            link = getMagnetLink(link);
        }

        AudioJS.setup();
        window.btapp = new Btapp();

        var status = new StatusView({model: btapp});

        btapp.connect({
            product: 'uTorrent',
            plugin: false
        });

        btapp.live('torrent * file * properties', function(properties, file, file_list, torrent, torrent_list) {
            console.log('uri: ' + torrent.get('properties').get('uri'));
            if(torrent.get('properties').get('uri') === link) {
                var name = properties.get('name');
                console.log('file in the correct torrent: ' + name);
                if(_.include(SUPPORTED_VIDEO_EXTENSIONS, name.substr(name.length - 3))) {
                    var view = new VideoFileView({model: properties});
                    $('body > .container').append(view.render().el);
                } else if(_.include(SUPPORTED_AUDIO_EXTENSIONS, name.substr(name.length - 3))) {
                    var view = new AudioFileView({model: properties});
                    $('body > .container').append(view.render().el);
                }
            }
        });

        btapp.on('add:add', function(add) {
            console.log('adding: ' + link);
            add.torrent(link);
        });
    } else {
        var input = new InputView();
        $('body > .container').append(input.render().el);
    }
});