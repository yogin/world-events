(function(mapContainer) {
  var container = document.getElementById(mapContainer);
  var particleSize = 16;
  var colorsAvailable = [ 'white', 'red', 'green', 'yellow', 'cyan', 'magenta', 'orange' ];

  var eventTypes = {
    'event': {
      color: 'red',
      ttl: 1
    }
  };

  var map = new Datamap({
    element: container,
    fills: {
      defaultFill: 'rgba(40,60,80,0.9)'
    },
    geographyConfig: {
      highlightOnHover: true,
      popupOnHover: true,
      hideAntarctica: false,
      borderWidth: 0.5,
      borderColor: 'rgba(17,17,17,1)',
      highlightFillColor: 'rgba(40,60,80,0.7)',
      highlightBorderColor: 'rgba(17,17,17,1)',
      highlightBorderWidth: 0.5,
      popupTemplate: function(geography, data) {
        return '<div class="country-info"><strong>' + geography.properties.name + '</strong></div>';
      }
    },
    done: function(datamap) {
    }
  });

  map.addPlugin('particle', function(layer, data, options) {
    var self = this;
    var className = 'datamaps-particle';

    var gradients = layer.selectAll('defs')
                          .data(['defs'])
                          .enter()
                            .append('defs')
                            .selectAll('radialGradient')
                              .data(colorsAvailable)
                              .enter()
                                .append('radialGradient')
                                .attr('id', function(d, i) { return 'gradient-'+d; })

    gradients.append('stop')
              .attr('offset', '1%')
              .attr('stop-color', function(d, i) { return d; })
              .attr('stop-opacity', 0.99)

    gradients.append('stop')
              .attr('offset', '1.5%')
              .attr('stop-color', function(d, i) { return d; })
              .attr('stop-opacity', 0.95)

    gradients.append('stop')
              .attr('offset', '2%')
              .attr('stop-color', function(d, i) { return d; })
              .attr('stop-opacity', 0.85)

    gradients.append('stop')
              .attr('offset', '10%')
              .attr('stop-color', function(d, i) { return d; })
              .attr('stop-opacity', 0.25)

    gradients.append('stop')
              .attr('offset', '17%')
              .attr('stop-color', function(d, i) { return d; })
              .attr('stop-opacity', 0.05)

    gradients.append('stop')
              .attr('offset', '25%')
              .attr('stop-color', function(d, i) { return d; })
              .attr('stop-opacity', 0.00)

    layer
      .selectAll(className)
      .data(data, JSON.stringify)
      .enter()
        .append('circle')
        .attr('class', className)
        .attr('cx', function(datum){
            var latLng = self.latLngToXY(datum.latitude, datum.longitude);
            if (latLng) return latLng[0];
        })
        .attr('cy', function(datum){
            var latLng = self.latLngToXY(datum.latitude, datum.longitude);
            if (latLng) return latLng[1];
        })
        .attr('r', 0)
        .attr('fill', function(datum) { return 'url(#gradient-'+datum.color+')'; })
        .transition(1000) // 1 second to 'fade-in'
          .delay(function(d, i) { return i / data.length * 1000; })
          .attr('r', function(datum) { return datum.size; })
        .transition(1000) // 1 second to 'fade-out'
          .delay(function(d, i) { return 600000 * d.ttl; }) // 10 minutes * ttl lifetime
          .attr('r', 0)
          .remove(); // delete particle (auto purge)
  });

  var createEventParticle = function(e) {
    var eventParticle = {
      id: e.type + '_' + e.id,
      size: particleSize,
      ttl: eventTypes[e.type].ttl,
      color: eventTypes[e.type].color,
      latitude: e.latitude,
      longitude: e.longitude
    };

    // TODO switch on e.type to customize properties

    return eventParticle;
  };

  var onEventMessage = function(e) {
    var data = JSON.parse(e.data);
    var events = [];

    for (var i = 0; i < data.length; i++) {
      events.push(createEventParticle(data[i]));
    }

    if (events.length > 0) {
      map.particle(events);
    }
  };

  var onPingMessage = function(e) {
    // ping
  };

  var onConnectionError = function(show) {
    if (show) {
      console.log("connection lost!");
    }
    else {
      console.log("connected!");
    }
  };

  var WE = (function(){
    var eventSource;

    if (!!window.EventSource) {
      eventSource = new EventSource('/stream');
      eventSource.onopen  = function() { onConnectionError(false); };
      eventSource.onclose = function() { onConnectionError(true); };
      eventSource.onerror = function() { onConnectionError(true); };
      eventSource.addEventListener('ping', onPingMessage);
      eventSource.addEventListener('events', onEventMessage);
    }
    else {
      console.log('Streaming not supported!');
    }
    
    return eventSource;
  })();

})('container');
