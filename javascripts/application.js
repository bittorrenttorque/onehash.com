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
        'plugin:client_running': 'client running',
        'client:connected': 'client connecting',
        'client:disconnected': 'client disconnected',
        'sync': 'client connected',
        'client:error': 'error',
        'input:creating_torrent': 'creating torrent',
        'input:torrent_created': 'torrent created',
        'input:redirecting': 'redirecting',
        'input:waiting_for_folder_selection': 'waiting for selection'
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

    function create_torrent_filename(arg) {
        var paths = typeof arg === 'string' ? [arg] : arg;
        var default_path, filename;
        default_path = paths[0];
        filename = filename_from_filepath(default_path);
        if (paths.length > 1) {
            return remove_extension(filename) + '_and_others';
        } else {
            return filename;
        }
    }

    function remove_extension(filename) {
        var nameArray;
        nameArray = filename.split('.');
        if (nameArray.length > 1) {
            return _.first(nameArray, nameArray.length - 1).join('.');
        } else {
            return nameArray[0];
        }
    }

    function filename_from_filepath(filepath) {
        var filename;
        filename = _.last(filepath.split('\\'));
        return _.last(filename.split('/'));
    }

    var AudioFileView = Backbone.View.extend({
        initialize: function() {
            this.template = _.template($('#audio_template').html());
            this.model.on('destroy', this.remove, this);
        },

        render: function() {
            this.$el.html(this.template({
                url: this.model.get('streaming_url'),
                name: filename_from_filepath(this.model.get('name'))
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
                name: filename_from_filepath(this.model.get('name')),
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
            this.$el.html(this.template({}));
            this.$el.find('form').submit(_.bind(function(event) {
                 window.location = '#' + this.$el.find('input').val();
            }, this));
            this.$el.find('#create').click(_.bind(function(event) {
                event.preventDefault();
                var product = 'Torque';

                var btapp = new Btapp;
                btapp.connect({
                    queries: ['btapp/create/', 'btapp/browseforfolder/'],
                    product: product,
                    poll_frequency: 500
                });

                var status = new StatusView({model: btapp, product: product});
                $('.toolbox').append(status.render().el);

                var browse_ready = function() {
                    btapp.off('add:bt:browseforfolder', browse_ready);
                    btapp.trigger('input:waiting_for_folder_selection');
                    btapp.browseforfolder(function(folder) {
                        var create_callback = function(data) {
                            btapp.disconnect();
                            btapp.trigger('input:torrent_created');
                            setTimeout(_.bind(btapp.trigger, btapp, 'input:redirecting'), 1000);
                            setTimeout(function() {
                                window.location = '#' + data;
                            }, 4000);
                        }

                        btapp.create(create_torrent_filename(folder), [folder], create_callback);
                        btapp.trigger('input:creating_torrent');
                    });
                };
                btapp.on('add:bt:browseforfolder', browse_ready);
            }, this));
            return this;
        }
    });

    var StatusView = Backbone.View.extend({
        tagName: 'span',
        initialize: function() {
            this.status = 'uninitialized';
            this.model.on('all', this.update, this);
        },
        update: function(e) {
            if(e in STATUS_MESSAGES) {
                this.status = STATUS_MESSAGES[e];
                this.render();
            }
        },
        render: function() {
            this.$el.text(',  ' + this.options.product + ' ( ' + this.status + ' ) ');
            return this;
        }
    });

    function connectProduct(product, plugin, hash) {
        var link = isInfoHash(link) ? getMagnetLink(link) : hash;

        console.log('connectProduct(' + product + ',' + hash + ')');
        var btapp = new Btapp();

        var status = new StatusView({model: btapp, product: product});
        $('.toolbox').append(status.render().el);

        btapp.connect({
            product: product,
            plugin: plugin
        });

        var selector = 'torrent * file * properties';
        var file_callback = function(properties) {
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
        var live_callback = function(properties, file, file_list, torrent, torrent_list) {
            console.log('uri: ' + torrent.get('properties').get('uri'));
            console.log('download_url: ' + torrent.get('properties').get('download_url'));
            console.log('info_hash: ' + torrent.id);

            if( (isInfoHash(link) && torrent.id === hash) || 
                torrent.get('properties').get('download_url') === link ||
                torrent.get('properties').get('uri') === link
            ) {
                file_callback(properties);
            }
        };

        btapp.live(selector, live_callback);

        var add_callback = function(add) {
            btapp.off('add:add', add_callback);
            console.log('adding: ' + link);
            add.torrent(link);
        }
        btapp.on('add:add', add_callback);

        return btapp;
    }

    var hash = window.location.hash.substring(1);
    console.log('hash: ' + hash);
    if(hash) {
        AudioJS.setup();
        //window.uTorrent = connectProduct('uTorrent', false, link);
        window.Torque = connectProduct('Torque', true, hash);
        //window.BitTorrent = connectProduct('BitTorrent', false, link);
    } else {
        var input = new InputView();
        $('body > .container').append(input.render().el);
    }

    $(window).bind('hashchange', _.debounce(_.bind(location.reload, location)));
});