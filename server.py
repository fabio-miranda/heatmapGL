import cherrypy
import csv
import json
import math
import os
import numpy

HTML_DIR = os.path.join(os.path.abspath("."), u"www")

class ScatterPage:

  # Default constructor reading app config file.
  def __init__(self):
    # Reads configuration file with application folders and server port.
    self.config = os.path.join(os.path.dirname(__file__), 'config.conf')


  # Given a timestamp, returns the bucket index containing it.
  def getBucketIndex(self, ts, initial_ts, bucketsize):
    return int(math.floor((int(ts) - initial_ts) / bucketsize))

  # Access to index.html, the entry point in the application.
  @cherrypy.expose
  def index(self, datapath = None, zoom = None, lat0 = None, lng0 = None, lat1 = None, lng1 = None, alphamult = None):
    return open(os.path.join(HTML_DIR, u'index.html'))


  # Return information about the dataset.
  # Information is stored in info.txt
  # numpoints
  # bucketcount
  # bucketsize
  # tsmin
  # tsmax
  # latmin
  # latmax
  # lngmin
  # lngmax
  @cherrypy.expose
  def getInfo(self, datapath):

    fullpath = cherrypy.request.app.config['data']['path']+datapath

    try:
      inputfile = open(fullpath+'/info.txt')

      print fullpath

      info = {}
      info['numpoints'] = int(inputfile.readline().split(':')[1].rstrip('\n'))
      info['bucketcount'] = int(inputfile.readline().split(':')[1].rstrip('\n'))
      info['bucketsize'] = int(inputfile.readline().split(':')[1].rstrip('\n'))
      info['tsmin'] = int(inputfile.readline().split(':')[1].rstrip('\n'))
      info['tsmax'] = int(inputfile.readline().split(':')[1].rstrip('\n'))
      info['latmin'] = float(inputfile.readline().split(':')[1].rstrip('\n'))
      info['latmax'] = float(inputfile.readline().split(':')[1].rstrip('\n'))
      info['lngmin'] = float(inputfile.readline().split(':')[1].rstrip('\n'))
      info['lngmax'] = float(inputfile.readline().split(':')[1].rstrip('\n'))

    except IOError:
      #if file not found, return default values, similar to locserver.py
      BUCKET_SIZE = 10 * 60
      GMT_BUCKET_TS_INITIAL = 1375228800
      GMT_BUCKET_TS_FINAL = 1377734400
      ANIM_STEP = 1 * 60 * 60

      info = {}
      #info['numpoints'] = 0
      info['bucketcount'] = (GMT_BUCKET_TS_FINAL - GMT_BUCKET_TS_INITIAL) / BUCKET_SIZE
      info['bucketsize'] = BUCKET_SIZE
      info['tsmin'] = 1375228800
      info['tsmax'] = 1377748800 - ANIM_STEP

      #info['latmin'] = 0
      #info['latmax'] = 0
      #info['lngmin'] = 0
      #info['lngmax'] = 0
    

    # Returns a json with info.
    cherrypy.response.headers['Content-Type'] = "application/json;"
    return json.dumps(info)



  # Returns list of points that occurred between timestamp interval
  # (query_ts1, query_ts2]. Timestamps are in epoch seconds.
  # Optional parameter opt_compact lets client request compact data
  # (with only lat, lon and accuracy) or complete (lat, lon, acc,
  # xid and timestamp in epoch seconds.
  @cherrypy.expose
  def getPoints(self, query_ts1, query_ts2, initial_ts, final_ts, bucketsize, datapath, max_accuracy = 1000):

    fullpath = cherrypy.request.app.config['data']['path']+datapath+'/'
    initial_ts = int(initial_ts)
    final_ts = int(final_ts)
    bucketsize = int(bucketsize)

    bucket_index_1 = self.getBucketIndex(query_ts1, initial_ts, bucketsize)
    bucket_index_2 = self.getBucketIndex(query_ts2, initial_ts, bucketsize)

    # Stores lat/lon for points, and mininum/maximum latitude and longitude.
    points = []
    points_lat = []
    points_lon = []
    values = []
    min_lat = float('inf')
    max_lat = float('-inf')
    min_lon = float('inf')
    max_lon = float('-inf')
    min_value = float('inf')
    max_value = float('-inf')

    #print '\n\n\n\n'
    #print query_ts1, query_ts2, initial_ts, bucketsize, bucket_index_1, bucket_index_2
    count = 0
    for bucket_index in range(bucket_index_1, bucket_index_2):
      filename = fullpath + str(bucket_index) + '.csv'
      with open(filename) as input_file:
        csv_reader = csv.reader(input_file)

        # CSV format: ts (in seconds), lat, lon, value
        # CSV format (mobiles): xid, ts (in seconds), accuracy, lat, lon
        for point in csv_reader:

          value = 1.0

          #mobile data
          if(len(point) == 5):
            acc = float(point[2])
            lat = float(point[3])
            lon = float(point[4])

            #if(acc > float(max_accuracy)):
              #break


          else:
            lat = float(point[1])
            lon = float(point[2])

            #check if data has third attribute
            if(len(point) > 3):
              value = float(point[3])


          #if(lat > 40.73 and lon > -74.01 and lat < 40.74 and lon < -73.97):
          if(True):
          #New york BB
          #if(lon > -74.2557 and lat > 40.4957 and lon <  -73.6895 and lat < 40.9176):

            point_entry = [lat, lon, value]
            #if not opt_compact:
            #  point_entry += point[0:2]
            points.append(point_entry)
            

            # Updates min/max
            min_lat = min(min_lat, lat)
            max_lat = max(max_lat, lat)
            min_lon = min(min_lon, lon)
            max_lon = max(max_lon, lon)
            min_value = min(min_value, value)
            max_value = max(max_value, value)

          #if(count == 500):
          #  break
          #count+=1

    #print '\n\n requested (' + str(bucket_index_1) + ', ' \
    #    + str(bucket_index_2) + ']\t points: ' + str(len(points))

    # Prepares return data structure.
    data = {}
    data['ts1'] = query_ts1
    data['points'] = points
    #data['h'] = 1.06 * 0.5 * (numpy.std(points_lat) + numpy.std(points_lon)) * pow(len(points), -0.2)

    print max_lat, min_lat
    for i in range(0, len(points)):
      lat = float(points[i][0])
      lon = float(points[i][1])
      #if(lat > 40.702 and lon > -74.03 and lat < 40.77 and lon < -73.87):
      if(True):
        points_lat.append(lat)
        points_lon.append(lon)
        #points_lat.append((lat - min_lat) / (max_lat - min_lat))
        #points_lon.append((lon - min_lon) / (max_lon - min_lon))
        #print points_lat[i]
        #values.append(value)


    #print '\n\n\n\n\n\n'
    #lath = 0.96 * pow(len(points), (-1.0/6.0))
    #lonh = 0.96 * pow(len(points), (-1.0/6.0))
    #lath = (1.06 * (numpy.std(points_lat)) * pow(len(points_lat), -0.2))# * (max_lat - min_lat)
    #lonh = 1.06 * (numpy.std(points_lon)) * pow(len(points_lon), -0.2)# * (max_lon - min_lon)
    #valh = 1.06 * (numpy.std(values)) * pow(len(points), -0.2)
    #print len(points_lat) ** (-1.0/(2.0+4.0))
    #lath = 1.0 * (numpy.std(points_lat)) * pow(len(points), -(1.0/6.0))
    #lonh = 1.0 * (numpy.std(points_lon)) * pow(len(points), -(1.0/6.0))
    #print 'lat h '+str(lath)
    #print 'lon h '+str(lonh)
    #print 'val h '+str(valh)
    #print 'avg h '+str(0.5*(lath+lonh))
    #print '\n\n\n\n\n\n'
    data['h'] = 0.01#0.5*(lath+lonh)#0.01
    data['min_lat'] = min_lat
    data['min_lon'] = min_lon
    data['max_lat'] = max_lat
    data['max_lon'] = max_lon
    data['min_value'] = min_value
    data['max_value'] = max_value

    # Returns a json with data.
    cherrypy.response.headers['Content-Type'] = "application/json;"
    return json.dumps(data)



if __name__ == '__main__':
  scatterPage = ScatterPage()

  # CherryPy always starts with app.root when trying to map request URIs
  # to objects, so we need to mount a request handler root. A request
  # to '/' will be mapped to HelloWorld().index().
  app = cherrypy.quickstart(scatterPage, config=scatterPage.config)
else:
  scatterPage = ScatterPage()
  # This branch is for the test suite; you can ignore it.
  app = cherrypy.tree.mount(scatterPage, config=scatterPage.config)
