{{ fullname | escape | underline}}

{% if objtype in ['module', 'package'] %}
.. automodule:: {{ fullname }}

 {% if modules %}
 .. rubric:: Modules

 .. autosummary::
    :toctree:
    :template: custom-pydantic-model-template.rst
    :recursive:
 {% for item in modules %}
    {{ item }}
 {%- endfor %}
 {% endif %}

 {% set public_members = [] %}
 {% for item in members %}
    {% if not item.startswith('_') %}
       {% set _ = public_members.append(item) %}
    {% endif %}
 {% endfor %}

 {% if public_members %}
 .. rubric:: Models

 .. autosummary::
    :toctree:
    :template: custom-pydantic-model-template.rst
 {% for item in public_members %}
    {{ fullname }}.{{ item }}
 {%- endfor %}
 {% endif %}

{% elif objtype == 'pydantic_model' %}
.. currentmodule:: {{ module }}

.. autopydantic_model:: {{ objname }}
 :members:
 :undoc-members:
 :model-summary-list-order: bysource
 :model-show-validator-members: False
 :model-show-validator-summary: False
 :model-show-config-summary: False
 :model-show-json: False
{% endif %}