# Geographic data and attribution

The offshore scenery is packaged with the application so Sail Trainer 3D continues to work without a network connection. Runtime code does not contact a map, elevation, or tile service.

## OpenStreetMap

Coastline geometry and height-tagged building footprints were extracted from OpenStreetMap through the Overpass API on 2026-09-18. The processed data is stored in `src/coast-data.js` as local metre coordinates, simplified shoreline samples, and axis-aligned low-detail building dimensions.

Data © OpenStreetMap contributors, available under the Open Database License: <https://www.openstreetmap.org/copyright>

Extraction bounds (south, west, north, east):

| Setting | Bounds |
|---|---|
| Tel Aviv | 32.00, 34.72, 32.12, 34.82 |
| Bat Yam | 31.97, 34.70, 32.04, 34.78 |
| Netanya | 32.26, 34.82, 32.36, 34.90 |
| Haifa | 32.76, 34.93, 32.88, 35.04 |

Only features explicitly present in the source extract are rendered. Buildings without a usable `height` or `building:levels` tag are omitted instead of being assigned an invented height. The renderer intentionally simplifies sourced footprints to boxes for distant-scene performance.

## Copernicus DEM

Terrain heights were sampled from the Copernicus DEM GLO-30 public AWS tile `Copernicus_DSM_COG_10_N32_00_E034_00_DEM`, last modified 2022-05-09. Each setting stores a 500-metre grid derived from the 30-metre source; the original GeoTIFF is not shipped.

Copernicus DEM information and licence: <https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM>

The terrain grid preserves source elevations at sampled positions. Shorelines are rendered from OpenStreetMap rather than inferred from terrain heights, because the elevation raster contains near-sea-level values that are not a precise coastal boundary.

## Coordinate system and limits

Each setting uses a documented WGS84 offshore origin in `src/coast-data.js`. The packaged GIS working frame stores easting as positive; the coastline scene root converts it to the simulator convention where compass east (090°) is world `−X`. Latitude maps to world `+Z` (north), and elevations remain metres. Exercise coordinates retain their existing local metre layout around the offshore origin.

The scenery supports orientation and place recognition. Land collision, grounding, docks, tides, bathymetry, and near-shore navigation are outside the simulator model.
