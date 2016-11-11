# simplescatter
Simple heatmap using WebGL

# Steps to use:
1. Place data inside folder "./data/[name]/". This same folder must also contain a file info.txt, similar to:

	numpoints: 542059
	bucketcount: 24
	bucketsize: 3600
	tsmin: 1329350400
	tsmax: 1329436800
	latmin: 40.62124942228224
	latmax: 40.867054953252676
	lngmin: -74.09883499145508
	lngmax: -73.69783401489258

where:
	numpoints: number of points in all buckets
	bucketcount: number of csv files
	bucketsize: time range of each csv file, in seconds
	tsmin: first timestep
	tsmax: last timestep
	latmin,latmax,lngmin,lngmax: spatial boud of data


2. Run server:
	python server.py

3. Open http://localhost:8080/?datapath=/[name], where [name] should be replaced by the folder name created in step 1

![Heatmap GL](https://vgc.poly.edu/~fmiranda/heatmap/heatmap-teaser.png)

More: https://vgc.poly.edu/~fmiranda/heatmap/

