..
   Master "index". This will be converted to a landing index.html by sphinx. We
   define TOC here, but it'll be put in the sidebar by the theme

=============
Ibex Manual
=============

IBEX is a web-based application designed for efficient traversal and visualization of data stored in the Integrated Data Structure (IDS).
The application follows a client–server architecture, consisting of a frontend for interactive data exploration and a backend responsible for
data processing and communication with data sources. The backend leverages the `IMAS Python <https://github.com/iterorganization/IMAS-Python>`_ to access, parse, and manipulate IDS data,
enabling seamless integration with existing IMAS-compatible databases.
IBEX features a modular and extensible architecture, with the IMAS Python API encapsulated as a replaceable component, allowing it to be substituted with an alternative data access layer if needed.


Manual
------

.. toctree::
   :caption: User's manual
   :maxdepth: 1

   users_manual/how_to_launch
   users_manual/features

.. toctree::
   :caption: Developer's manual
   :maxdepth: 1

   developers_manual/frontend_development/frontend_development
   developers_manual/backend_development/backend_development