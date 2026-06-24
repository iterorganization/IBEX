{{ fullname | escape | underline}}

.. automodule:: {{ fullname }}

   {% block attributes %}
   {% if attributes %}
   .. rubric:: {{ _('Module Attributes') }}

   .. autosummary::
      :toctree:
   {% for item in attributes %}
      {{ item }}
   {%- endfor %}
   {% endif %}
   {% endblock %}

   {% block functions %}
   {% if functions %}
   .. rubric:: {{ _('Functions') }}

   .. autosummary::
      :toctree:
   {% for item in functions %}
      {{ item }}
   {%- endfor %}
   {% endif %}
   {% endblock %}

   {% block classes %}
   {% if classes %}
   .. rubric:: {{ _('Classes') }}

   .. autosummary::
      :toctree:
      :template: custom-class-template.rst
   {% for item in classes %}
      {{ item }}
   {%- endfor %}
   {% endif %}
   {% endblock %}

   {% block exceptions %}
   {% if exceptions %}
   .. rubric:: {{ _('Exceptions') }}

   .. autosummary::
      :toctree:
   {% for item in exceptions %}
      {{ item }}
   {%- endfor %}
   {% endif %}
   {% endblock %}

   {% block modules %}
   {% if modules %}
   .. rubric:: Modules

   {% set schema_modules = [] %}
   {% set regular_modules = [] %}
   {% for item in modules | reject("equalto", "test") %}
   {% if item == "ibex.endpoints.schemas" %}
   {% set _ = schema_modules.append(item) %}
   {% else %}
   {% set _ = regular_modules.append(item) %}
   {% endif %}
   {% endfor %}

   {% if regular_modules %}
   .. autosummary::
    :toctree:
    :template: custom-module-template.rst
    :recursive:
   {% for item in regular_modules %}
    {{ item }}
   {%- endfor %}
   {% endif %}

   {% if schema_modules %}
   .. autosummary::
    :toctree:
    :template: custom-pydantic-model-template.rst
    :recursive:
   {% for item in schema_modules %}
    {{ item }}
   {%- endfor %}
   {% endif %}

   {% endif %}
   {% endblock %}
