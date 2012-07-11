jQuery(function() {
    var FileView = Backbone.View.extend({
        initialize: function() {
            this.template = _.template($('#video_template').html());
        },
        render: function() {
            this.$el.html(this.template({
            }));
            return this;
        }
    });

    var InputView = Backbone.View.extend({
        initialize: function() {
            this.template = _.template($('#input_template').html());
        },
        render: function() {
            this.$el.html(this.template({
            }));
            return this;
        }
    });

    var input = new InputView();
    $('body > .container').append(input.render().el);

    btapp = new Btapp();
    btapp.connect();

    btapp.live('torrent * file * properties', function(properties) {
        var view = new FileView({model: properties});
        $('body > .container').append(view.render().el);
    });
});