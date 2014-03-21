require 'sinatra'
require 'redis'
require 'json'
require 'pry'
require 'eventmachine'

class EventFeed

  def initialize(options = {})
    redis = options[:redis] or raise 'missing redis option'
    @redis = Redis.new(url: redis)

    @queue = options[:queue] or raise 'missing redis queue option'
    @limit = options[:limit] or raise 'missing redis pop limit option'
  end

  def broadcast!(connections)
    # always consume events even if there are no connections
    payload = event_data('events', events)
    return if payload.empty?

    connections.each do |connection|
      connection << payload
    end
  end

  def ping!(connections)
    now = Time.now

    connections.each do |connection|
      connection << ping(now)
    end
  end

  def enqueue!(data)
    return unless @redis.llen(@queue) < 10_000
    @redis.rpush(@queue, data.to_json)
  end

  private

  def ping(now)
    event_data(:ping, :time => now)
  end

  def events
    events = @redis.lrange(@queue, 0, @limit - 1).tap do |events|
      @redis.ltrim(@queue, events.size, -1)
    end

    events.map { |event| JSON(event) }
  end

  def event_data(type, data)
    "event: #{type}\ndata: #{data.to_json}\n\n"
  end

end

class WorldEvents < Sinatra::Base

  TIMER_INTERVAL = 2
  PING_INTERVAL = 15

  REDIS_URI = "redis://127.0.0.1:6379/0"
  REDIS_QUEUE = 'worldevents:queue'
  REDIS_POP_COUNT = 100

  set :server, :thin
  set :public_folder, File.dirname(__FILE__) + '/public'

  set :stream_connections, []
  set :timer, nil
  set :feed, nil
  set :ping_timer, 0

  configure :production, :development do
    enable :logging

    EventMachine.next_tick do
      settings.feed = EventFeed.new(redis: REDIS_URI, queue: REDIS_QUEUE, limit: REDIS_POP_COUNT)
      settings.timer = EventMachine.add_periodic_timer(TIMER_INTERVAL) do
        settings.feed.broadcast!(settings.stream_connections)

        settings.ping_timer += TIMER_INTERVAL
        if settings.ping_timer >= PING_INTERVAL
          settings.feed.ping!(settings.stream_connections)
          settings.ping_timer = 0
        end
      end
    end
  end

  helpers do
    def geolocations
      @geolocations ||= File.read(File.dirname(__FILE__)+'/misc/geolocations.csv').split("\n").map{ |d| d.split(',').map(&:to_f) }.shuffle
    end

    def geolocation
      geo = geolocations.sample
      { :latitude => geo[0], :longitude => geo[1] }
    end
  end

  get '/seed' do
    stream(:keep_open) do |out|
      @seed_timer ||= EM.add_periodic_timer(5) do
        Random.rand(1_000).times do
          data = {
            :id => Random.rand(1_000_000_000),
            :type => [ :event ].sample,
            :time => Time.now.to_i,
          }.merge(geolocation)

          settings.feed.enqueue!(data)
        end
      end
    end
  end

  get '/stream', provides: 'text/event-stream' do
    stream(:keep_open) do |out|
      settings.stream_connections << out
      out.callback { settings.stream_connections.delete(out) }
    end
  end

  get '/' do
    erb :index
  end

end
