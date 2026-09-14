===================
Configuration file
===================

When you save a configuration, a file in the following format will be created. It contains all the data related to your setup. This file allows you to restore the configuration exactly as you left it (charts, grid positions, selected URIs, preferences, etc.).

You can share configuration files with other users to quickly access their workspace.

You can also edit the file manually before loading it. However, this is not recommended and dangerous. It should only be done with caution by experienced users, as incorrect edits could cause unwanted bugs in the configuration.

Exemple configuration file :

.. code-block:: bash

  {
    "name": "myNewConfiguration",
    "dataURI": [
      {
        "name": "URI-0",
        "uri": "imas:hdf5?user=imbeauf;pulse=58089;run=4;database=west;version=3",
        "uriColor": "#2e8613",
        "isSelected": true
      }
    ],
    "dataPlot": [
      {
        "title": "t_e_URI-0",
        "isTitleOverwritten": false,
        "displayErrorBand": false,
        "synchronizedGrids": {
          "color": "",
          "list": []
        },
        "interpolated_method": "exact_value",
        "xAxisData": {
          "name": "time",
          "unit": "s",
          "path": "#ece/time"
        },
        "yAxisData": {
          "name": "t_e",
          "unit": "eV"
        },
        "i": "573b4b6c-7c1a-4611-ae40-45d057a85d5a",
        "x": 0,
        "y": 0,
        "w": 6,
        "h": 12,
        "coordinates": [
          {
            "axeIndex": 0,
            "path": "#ece/time",
            "target": "#ece/channel[0]/t_e/data[0]",
            "valueIndex": 0
          },
          {
            "axeIndex": 1,
            "path": "",
            "target": "#ece/channel[0]",
            "valueIndex": 0
          }
        ],
        "plot": [
          {
            "nodeUri": "URI-0#ece:0/channel[0]/t_e/data",
            "yaxis": "",
            "labelUri": "URI-0",
            "line": {
              "color": "rgb(31, 119, 180)"
            },
            "customPreferences": {},
            "mode": "line"
          }
        ]
      }
    ]
  }
