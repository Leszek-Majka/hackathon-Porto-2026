import ifcopenshell

print("ifcopenshell version:", ifcopenshell.version)

# Quick sanity check: create a minimal IFC model in memory
model = ifcopenshell.file()
project = model.create_entity("IfcProject", GlobalId=ifcopenshell.guid.new(), Name="HackathonProject")
print("IFC project created:", project.Name)
print("Ready to build!")
