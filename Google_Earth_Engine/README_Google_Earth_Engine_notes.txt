OVERVIEW OF THESE FILES
Kara Leimberger, 2/27/2022

CODE (.txt)

- Written in JavaScript, can be run using Google Earth Engine API (code.earthengine.google.com)
- 01_Processing_digitized_layers - removes patches smaller than a certain threshold.
- 02_Calculating_connectivity - calculates functional connectivity ("weighted patch area") based on hummingbird gap-crossing ability and average home range length

Additional notes about the code can be found in the text files.

OTHER FILES (mostly spatial layers)

1. Digitized_forest_layer - hand digitization. Imagery from 2018, digitization completed in 2020.
2. Costa_Rica_study_area - rectangle encompassing general study area
3. Patch_centroids_2016-2018 - focal area centroids
4. Patch_centroids_2016-2018_Buffer1000 - focal area centroids, buffered by 1000m radius.

5. Digitized_forest_layer_small_removed_20200630.kml - exported from '01_Processing_digitized_layers'. Could probably be re-exported as shapefile if desired.
6. Forest_raster_with_matrix_20200630.tif - exported from '01_Processing_digitized_layers'.

7. Forest_raster_25m_buffer_with_matrix_20200630.tif - exported from '02_Calculating_connectivity'. Forest connected based on hummingbird gap-crossing ability (50m)
8. patchMetrics_20200701.csv - connectivity metrics, exported from '02_Calculating_connectivity'
9. Weighted_pixel_area_images_20200701 - folder of geotiffs, exported from '02_Calculating_connectivity'. Pixel weights based on cost distance and exponential decay function.
