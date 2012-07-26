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

    function readableFileSize(size) {
        var units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
        var i = 0;
        while(size >= 1024) {
            size /= 1024;
            ++i;
        }
        return size.toFixed(1) + ' ' + units[i];
    }

    function readableTransferRate(rate) {
        return readableFileSize(rate) + '/s';
    }

    var AppView = Backbone.View.extend({
        className: 'main',
        initialize: function() {
            this.template = _.template($('#media_container_template').html());
            var btapp = new Btapp();

            var torrent_match = isInfoHash(hash) ? hash.toUpperCase() : '*';
            var queries = [
                'btapp/showview/',
                'btapp/torrent/all/' + torrent_match + '/file/all/*/properties/all/size/',
                'btapp/torrent/all/' + torrent_match + '/file/all/*/properties/all/downloaded/',
                'btapp/torrent/all/' + torrent_match + '/file/all/*/properties/all/streaming_url/',
                'btapp/torrent/all/' + torrent_match + '/file/all/*/properties/all/name/',
                'btapp/torrent/all/' + torrent_match + '/properties/all/'
            ];

            btapp.connect({
                product: this.model.get('product'),
                plugin: this.model.get('plugin'),
                pairing_type: this.model.get('pairing_type'),
                queries: queries
            });

            btapp.live('torrent ' + torrent_match + ' properties', this.torrent, this);


            var status = new Backbone.Model({
                btapp: btapp,
                product: this.model.get('product'),
                status: 'uninitialized'
            });
            var statusview = new StatusView({model: status});
            $('.toolbox').append(statusview.render().el);
        },
        render: function() {
            this.$el.html(this.template({}));
            return this;
        },
        torrent: function(properties, torrent) {
            if(!properties || typeof properties !== 'object' || typeof properties.has === 'undefined') {
                return;
            }
            var hash = this.model.get('hash');
            if( (isInfoHash(hash) && torrent.id === hash) ||
                properties.get('download_url') === hash ||
                properties.get('uri') === hash
            ) {
                var view = new TorrentNameView({model: torrent});
                this.$el.find('.media.container > .media_header').append(view.render().el);

                torrent.live('file * properties', this.file, this);

                var stats = new TorrentDownloadView({model: torrent});
                this.$el.find('.stats.container .wrapper').append(stats.render().el);
            }
        },
        file: function(properties) {
            var name = properties.get('name');
            if(_.include(SUPPORTED_VIDEO_EXTENSIONS, name.substr(name.length - 3))) {
                var view = new VideoFileView({model: properties});
                this.$el.find('.media.container > .media').append(view.render().el);
            } else if(_.include(SUPPORTED_AUDIO_EXTENSIONS, name.substr(name.length - 3))) {
                var view = new AudioFileView({model: properties});
                this.$el.find('.media.container > .media').append(view.render().el);
            }
        }        
    });

    var TorrentNameView = Backbone.View.extend({
        initialize: function() {
            this.template = _.template($('#torrent_template').html());
            this.model.get('properties').on('change:name', this.render, this);
            this.model.on('destroy', this.destroy, this);
        },
        destroy: function() {
            this.model.off('change:name', this.render, this);
            this.remove();
        },
        render: function() {
            this.$el.html(this.template({
                name: this.model.get('properties').get('name')
            }));
            return this;
        }
    });

    var TorrentDownloadView = Backbone.View.extend({
        initialize: function() {
            this.template = _.template($('#torrent_download_template').html());
            this.model.get('properties').on('change', this.render, this);
            this.model.on('destroy', this.destroy, this);
        },
        destroy: function() {
            this.model.off('change', this.render, this);
            this.remove();
        },
        render: function() {
            var eta, progress, files;
            progress = this.model.get('properties').get('progress') / 10.0;
            if(progress == 100) {
                var date = new Date(this.model.get('properties').get('added_on') * 1000);
                eta = 'Added ' + humaneDate(date);
            } else {
                var date = new Date(this.model.get('properties').get('eta') * 1000 + (new Date()).getTime());
                eta = 'Complete In ' + humaneDate(date)
            }

            var files = this.model.get('file').map(function(file) { 
                return {
                    progress: 100 * file.get('properties').get('downloaded') / file.get('properties').get('size'),
                    downloaded: readableFileSize(file.get('properties').get('downloaded')),
                    size: readableFileSize(file.get('properties').get('size'))
                };
            });

            this.$el.html(this.template({
                progress: progress + '%',
                upload_speed: readableTransferRate(this.model.get('properties').get('upload_speed')),
                download_speed: readableTransferRate(this.model.get('properties').get('download_speed')),
                eta: eta,
                files: files,
                ratio: this.model.get('properties').get('ratio') / 1000.0
            }));
            return this;
        }
    });

    var AudioFileView = Backbone.View.extend({
        className: 'audio well',
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
        className: 'video well',
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
        className: 'status',
        initialize: function() {
            this.template = _.template($('#status_template').html());
            this.model.get('btapp').on('all', this.update, this);
            this.model.on('change', this.render, this);
        },
        destroy: function() {
            this.$el.off('click', this.click, this);
            this.model.get('btapp').off('all', this.update, this);
            this.model.off('change', this.render, this);
            this.remove();
        },
        update: function(e) {
            if(e in STATUS_MESSAGES) {
                this.model.set('status', STATUS_MESSAGES[e]);
            }
        },
        render: function() {
            this.$el.html(this.template({
                product: this.model.get('product'),
                status: this.model.get('status')
            }));
            return this;
        }
    });


    AudioJS.setup();
    var hash = window.location.hash.substring(1);
    if(hash) {
        var link = isInfoHash(hash) ? getMagnetLink(hash) : hash;
        var model;
        if(location.host.indexOf('github') !== -1) {
            model = new Backbone.Model({
                hash: hash,
                link: link,
                product: 'Torque'
            });
        } else {
            model = new Backbone.Model({
                hash: hash,
                link: link,
                product: 'uTorrent',
                plugin: false,
                pairing_type: 'native'    
            });
        }

        //add the torrent
        var btapp = new Btapp;
        btapp.connect({
            product: model.get('product'),
            plugin: model.get('plugin'),
            pairing_type: model.get('pairing_type'),
            queries: ['btapp/add/', 'btapp/create/']
        });
        var add_callback = function(add) {
            btapp.off('add:add', add_callback);
            add.torrent(link);
            btapp.disconnect();
        }
        btapp.on('add:add', add_callback);

        //display everything
        var container = new AppView({model: model});
        $('body').prepend(container.render().el);
    } else {
        var container = new InputContainerView();
        $('body').append(container.render().el);
    }

    $('.icon').click(function(e) {
        e.preventDefault();
        var _this = $(this);
        _this.parent().toggleClass('expanded');
        _this.parent().toggleClass('collapsed');
    });

    $(window).bind('hashchange', _.debounce(_.bind(location.reload, location)));
});