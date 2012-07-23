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
        'input:waiting_for_folder_selection': 'waiting for selection',
        'input:no_files_selected': 'no files selected'
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

    var MediaContainerView = Backbone.View.extend({
        className: 'media container',
        initialize: function() {
            this.template = _.template($('#media_container_template').html());
            AudioJS.setup();
            window.uTorrent = connectProduct('uTorrent', false, hash);
            window.Torque = connectProduct('Torque', true, hash);
            window.BitTorrent = connectProduct('BitTorrent', false, hash);
        },
        render: function() {
            this.$el.html(this.template({}));
            return this;
        }
    });

    var TorrentView = Backbone.View.extend({
        initialize: function() {
            this.template = _.template($('#torrent_template').html());
            this.model.on('add:properties', this.render, this);
            this.model.get('properties').on('change', this.render, this);
        },
        destroy: function() {
            this.model.off('change', this.render, this);
            this.remove();
        },
        render: function() {
            this.$el.html(this.template({
                properties: this.model.get('properties').toJSON()
            }));
            return this;
        }
    });

    var AudioFileView = Backbone.View.extend({
        className: 'audio',
        initialize: function() {
            this.template = _.template($('#audio_template').html());
            this.model.on('destroy', this.remove, this);
        },
        destroy: function() {
            this.model.off('destroy', this.remove, this);
            this.remove();
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
        className: 'video',
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

    var InputContainerView = Backbone.View.extend({
        className: 'input container',
        initialize: function() {
            var input = new InputView();
            this.$el.append(input.render().el);
        },
        render: function() {
            return this;
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
            this.$el.find('#create').on('click', this.create, this);
            return this;
        },
        create: function(event) {
            if(this.$el.find('#create').hasClass('disabled')) return;
            var button = this.$el.find('#create');
            button.addClass('disabled');
            event.preventDefault();
            var product = 'Torque';

            var btapp = new Btapp;
            btapp.connect({
                queries: ['btapp/create/', 'btapp/browseforfiles/'],
                product: product,
                poll_frequency: 500
            });

            var status = new StatusView({model: btapp, product: product});
            $('.toolbox').append(status.render().el);

            var browse_ready = function() {
                btapp.off('add:bt:browseforfiles', browse_ready);

                btapp.trigger('input:waiting_for_file_selection');
                btapp.browseforfiles(function(files) {
                    var files = _.values(files);
                    if(files.length === 0) {
                        btapp.trigger('input:no_files_selected');
                        setTimeout(function() {
                            btapp.disconnect();
                            status.destroy();
                            button.removeClass('disabled');
                        }, 3000);
                        return;
                    }
                    var create_callback = function(data) {
                        btapp.disconnect();
                        btapp.trigger('input:torrent_created');
                        setTimeout(_.bind(btapp.trigger, btapp, 'input:redirecting'), 1000);
                        setTimeout(function() {
                            btapp.disconnect();
                            status.destroy();
                            window.location = '#' + data;
                        }, 3000);
                    }

                    var torrent_name = create_torrent_filename(files);
                    console.log('btapp.create(' + torrent_name + ', ' + JSON.stringify(files) + ')');
                    btapp.create(torrent_name, files, create_callback);
                    btapp.trigger('input:creating_torrent');
                });
            };
            btapp.on('add:bt:browseforfiles', browse_ready);
        }
    });

    var StatusView = Backbone.View.extend({
        tagName: 'span',
        initialize: function() {
            this.status = 'uninitialized';
            this.model.on('all', this.update, this);
        },
        destroy: function() {
            this.model.off('all', this.update, this);
            this.remove();
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
        var link = isInfoHash(hash) ? getMagnetLink(hash) : hash;

        console.log('connectProduct(' + product + ',' + hash + ')');
        var btapp = new Btapp();

        var status = new StatusView({model: btapp, product: product});
        $('.toolbox').append(status.render().el);

        var torrent_match = isInfoHash(hash) ? hash.toUpperCase() : '*';
        var queries = [
            'btapp/torrent/all/' + torrent_match + '/file/all/*/properties/all/streaming_url/',
            'btapp/torrent/all/' + torrent_match + '/file/all/*/properties/all/name/',
            'btapp/torrent/all/' + torrent_match + '/properties/all/name/',
            'btapp/torrent/all/' + torrent_match + '/properties/all/download_url/',
            'btapp/torrent/all/' + torrent_match + '/properties/all/uri/',
        ];

        btapp.connect({
            product: product,
            plugin: plugin,
            pairing_type: plugin ? 'iframe' : 'native',
            queries: queries
        });

        var file_callback = function(properties) {
            var name = properties.get('name');
            if(_.include(SUPPORTED_VIDEO_EXTENSIONS, name.substr(name.length - 3))) {
                var view = new VideoFileView({model: properties});
                $('body > .media.container .media').append(view.render().el);
            } else if(_.include(SUPPORTED_AUDIO_EXTENSIONS, name.substr(name.length - 3))) {
                var view = new AudioFileView({model: properties});
                $('body > .media.container .media').append(view.render().el);
            }
        } 


        btapp.live('torrent ' + torrent_match + ' properties', function(properties, torrent) {
            if(!properties || typeof properties !== 'object' || typeof properties.has === 'undefined') {
                return;
            }
            if( (isInfoHash(link) && torrent.id === hash) ||
                properties.get('download_url') === link ||
                properties.get('uri') === link
            ) {
                var view = new TorrentView({model: torrent});
                $('body > .media.container .media_header').append(view.render().el);

                torrent.live('file * properties', function(file_properties) {
                    file_callback(file_properties);
                });
            }
        });


        var add_callback = function(add) {
            btapp.off('add:add', add_callback);
            add.torrent(link);
        }
        btapp.on('add:add', add_callback);

        return btapp;
    }

    var hash = window.location.hash.substring(1);
    if(hash) {
        var container = new MediaContainerView();
        $('body').append(container.render().el);
    } else {
        var container = new InputContainerView();
        $('body').append(container.render().el);
    }

    $(window).bind('hashchange', _.debounce(_.bind(location.reload, location)));
});