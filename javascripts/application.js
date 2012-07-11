jQuery(function() {
    _V_.EVENTS = [
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

    var FileView = Backbone.View.extend({
        initialize: function() {
            this.template = _.template($('#video_template').html());
            this.model.on('destroy', this.destroy, this);
        },
        destroy: function() {
            console.log('destroy');
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
        onPlayerEvent: function(event) {
            console.log(event);
            if(event === 'error') {
                console.log('cannot play ' + this.model.get('name'));
                this.destroy();
            }
        },
        bindPlayerEvents: function(player) {
            _.each(_V_.EVENTS, function(event) {
                player.addEvent(event, _.bind(this.onPlayerEvent, this, event));
            }, this);
        },
        unbindPlayerEvents: function(player) {
             _.each(_V_.EVENTS, function(event) {
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

    if(window.location.hash) {
        window.btapp = new Btapp();
        btapp.on('all', _.bind(console.log, console));
        btapp.connect();

        btapp.live('torrent * file * properties', function(properties) {
            var name = properties.get('name');
            if(name.substr(name.length - 3) === 'mp4') {
                var view = new FileView({model: properties});
                $('body > .container').append(view.render().el);
            }
        });

        btapp.on('add:add', function(add) {
            add.torrent(window.location.hash.substring(1));
        });
    } else {
        var input = new InputView();
        $('body > .container').append(input.render().el);
    }
});