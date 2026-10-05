# Dinur AI Office · 3D environment pack

40 individually importable GLB assets plus `sample_workspace.glb`, source script and catalog. Palette and proportions complement the character set. Individual meshes have meaningful names for recoloring and rearrangement. The sample workspace is a staging example.

## Use
- Import GLB into Blender, Godot, Unity, Three.js, or another glTF compatible editor.
- Units are meters; Z is up. Furniture faces negative Y. Most objects have their base at Z=0; desk objects have their base close to Z=0 and should be placed on the desk at Z≈0.78 m.
- Tile 3 m floors and walls. For a room corner, rotate wall segments as needed. `wall_with_window_3m` and `wall_with_door_3m` use surface overlays for editability: they are decorative modules, not physically cut openings.
- Change colors, sizes and positions in `build_office_assets.py`, then rerun `python build_office_assets.py` with numpy and trimesh installed.
- Static meshes only. No lighting engine setup, textures, rigging, collision meshes, or animations. Materials are embedded vertex colors. The flower and leaf shapes are stylized approximations.

## Suggested compatible palette
Ivory #F6F0E0 · wood #B78F65 · sage #99AF8B · lavender #BCA9C9 · dusty pink #E5AAA8 · mustard #CDB573. The pack is an original interpretation of the supplied character image.
