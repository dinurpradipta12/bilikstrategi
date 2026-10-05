"""Dinur AI Office modular 3D environment. Run: python build_office_assets.py
Dependencies: numpy, trimesh. Z up; meters; fronts of furniture face -Y.
Each GLB has individually named mesh parts with baked vertex colors.
"""
from pathlib import Path
import math, csv, zipfile
import numpy as np
import trimesh
P=Path(__file__).resolve().parent
A=P/'glb';A.mkdir(exist_ok=True)
C={
'ivory':(246,240,224,255),'warm_white':(255,250,239,255),'wall':(231,219,195,255),
'wood':(183,143,101,255),'wood_light':(214,182,140,255),'wood_dark':(125,86,59,255),
'sage':(153,175,139,255),'sage_dark':(94,121,92,255),'olive':(71,82,67,255),
'lavender':(188,169,201,255),'pink':(229,170,168,255),'peach':(239,200,169,255),
'blue':(139,180,188,255),'mustard':(205,181,115,255),'terracotta':(182,105,75,255),
'leaf':(84,139,87,255),'leaf_light':(117,169,103,255),'dark':(68,60,55,255),
'glass':(183,216,215,160),'screen':(65,82,88,255),'metal':(139,143,133,255),
'paper':(252,249,237,255),'coffee':(105,66,43,255)}

def scene():return trimesh.Scene()
def put(s,name,m,color,pos=(0,0,0)):
 m=m.copy();m.apply_translation(pos);m.visual.vertex_colors=np.tile(np.array(C.get(color,color),dtype=np.uint8),(len(m.vertices),1));s.add_geometry(m,geom_name=name,node_name=name)
def box(s,n,xyz,dim,col):put(s,n,trimesh.creation.box(extents=dim),col,xyz)
def orb(s,n,xyz,dim,col,sub=2):
 m=trimesh.creation.icosphere(subdivisions=sub,radius=1);m.apply_scale(dim);put(s,n,m,col,xyz)
def cyl(s,n,xyz,r,h,col,sections=20):put(s,n,trimesh.creation.cylinder(radius=r,height=h,sections=sections),col,xyz)
def rod(s,n,p,q,r,col):
 p=np.array(p);q=np.array(q);m=trimesh.creation.cylinder(radius=r,height=np.linalg.norm(q-p),sections=12)
 m.apply_transform(trimesh.geometry.align_vectors([0,0,1],q-p));put(s,n,m,col,(p+q)/2)
def leaf(s,n,xyz,scale,col='leaf',angle=0):
 m=trimesh.creation.icosphere(subdivisions=1,radius=1);m.apply_scale(scale)
 m.apply_transform(trimesh.transformations.rotation_matrix(angle,[0,0,1]));put(s,n,m,col,xyz)
def rounded(s,n,xyz,dim,col):
 # subtly rounded visual edges formed by overlapping ellipsoids
 box(s,n+'_core',xyz,(dim[0]*.87,dim[1]*.87,dim[2]),col)
 for x in [-1,1]:
  for y in [-1,1]:
   orb(s,n+f'_corner_{x}_{y}',(xyz[0]+x*dim[0]*.435,xyz[1]+y*dim[1]*.435,xyz[2]),(dim[0]*.065,dim[1]*.065,dim[2]*.50),col,1)
def save(name,s,category,dim,note):
 file=A/(name+'.glb');s.export(file)
 entries.append([name,category,*dim,note,file.stat().st_size])
 return s
entries=[]; scenes={}

def desk():
 s=scene();rounded(s,'desktop',(0,0,.73),(1.40,.75,.09),'wood_light')
 for x in [-.60,.60]:
  for y in [-.28,.28]:box(s,f'leg_{x}_{y}',(x,y,.355),(.075,.075,.71),'wood')
 box(s,'modesty_panel',(0,.31,.46),(1.20,.035,.35),'ivory');return s

def chair():
 s=scene();rounded(s,'seat',(0,0,.46),(.58,.54,.10),'lavender');rounded(s,'backrest',(0,.26,.85),(.58,.10,.76),'lavender')
 for x in [-.23,.23]:
  for y in [-.19,.19]:box(s,f'leg_{x}_{y}',(x,y,.22),(.055,.055,.40),'wood')
 return s

def swivel():
 s=scene();rounded(s,'seat',(0,0,.49),(.57,.55,.13),'sage');rounded(s,'backrest',(0,.24,.84),(.56,.12,.67),'sage')
 cyl(s,'hydraulic_column',(0,0,.28),.055,.40,'metal')
 for i in range(5):
  a=i*2*math.pi/5;rod(s,f'star_arm_{i}',(0,0,.10),(.31*math.cos(a),.31*math.sin(a),.10),.04,'dark')
  cyl(s,f'caster_{i}',(.31*math.cos(a),.31*math.sin(a),.045),.055,.09,'dark')
 for x in [-.32,.32]:box(s,f'armrest_{x}',(x,0,.69),(.065,.33,.075),'wood_light')
 return s

def stool():
 s=scene();cyl(s,'round_seat',(0,0,.64),.27,.11,'peach')
 for i in range(3):
  a=2*math.pi*i/3;rod(s,f'leg_{i}',(.18*math.cos(a),.18*math.sin(a),.59),(.29*math.cos(a),.29*math.sin(a),0),.035,'wood')
 return s

def meeting_table():
 s=scene();rounded(s,'tabletop',(0,0,.74),(2.3,1.1,.09),'wood_light')
 for x in [-.86,.86]:
  box(s,f'pedestal_{x}',(x,0,.36),(.12,.66,.72),'wood');box(s,f'base_{x}',(x,0,.055),(.65,.72,.08),'wood')
 return s

def cabinet():
 s=scene();box(s,'case',(0,0,.72),(.90,.46,1.44),'wood_light')
 for i in range(3):
  z=.22+i*.46;box(s,f'drawer_{i}',(0,-.245,z),(.78,.025,.39),'ivory')
  box(s,f'handle_{i}',(0,-.268,z),(.15,.028,.025),'wood_dark')
 return s

def shelf():
 s=scene()
 for x in [-.49,.49]:box(s,f'side_{x}',(x,0,.95),(.07,.39,1.9),'wood')
 for i,z in enumerate([.05,.55,1.05,1.55,1.9]):box(s,f'shelf_{i}',(0,0,z),(1.04,.42,.07),'wood_light')
 return s

def sofa():
 s=scene();rounded(s,'cushion',(0,0,.41),(1.7,.71,.31),'sage')
 rounded(s,'back',(0,.31,.82),(1.75,.17,.74),'sage')
 for x in [-.82,.82]:rounded(s,f'arm_{x}',(x,0,.60),(.18,.73,.48),'sage')
 for x in [-.65,.65]:box(s,f'foot_{x}',(x,0,.11),(.08,.48,.22),'wood')
 for x in [-.39,.39]:orb(s,f'cushion_{x}',(x,-.12,.53),(.30,.27,.14),'ivory')
 return s

def side_table():
 s=scene();cyl(s,'top',(0,0,.55),.36,.07,'wood_light');cyl(s,'stem',(0,0,.30),.055,.51,'wood');cyl(s,'foot',(0,0,.035),.27,.07,'wood');return s

def whiteboard():
 s=scene();box(s,'panel',(0,0,1.18),(1.65,.065,.95),'paper')
 for x in [-.86,.86]:box(s,f'frame_side_{x}',(x,0,1.18),(.045,.09,1.04),'wood_light')
 for z in [.68,1.68]:box(s,f'frame_topbottom_{z}',(0,0,z),(1.76,.09,.045),'wood_light')
 for x in [-.58,.58]:box(s,f'leg_{x}',(x,.01,.37),(.045,.06,.73),'metal')
 box(s,'marker_tray',(0,-.12,.65),(1.25,.18,.045),'wood_light');return s

def pinboard():
 s=scene();box(s,'cork',(0,0,.85),(1.20,.05,.85),'wood')
 for i,(x,z,col) in enumerate([(-.33,.93,'pink'),(.24,1.03,'ivory'),(-.01,.64,'blue')]):
  box(s,f'note_{i}',(x,-.045,z),(.25,.015,.28),col);orb(s,f'pin_{i}',(x,-.068,z+.12),(.025,.012,.025),'terracotta',1)
 return s

def monitor():
 s=scene();rounded(s,'bezel',(0,0,.90),(.80,.07,.50),'dark')
 box(s,'display',(0,-.040,.90),(.72,.01,.41),'screen');box(s,'stand',(0,.03,.47),(.055,.08,.40),'metal');box(s,'base',(0,.01,.27),(.32,.26,.03),'metal');return s

def laptop():
 s=scene();rounded(s,'keyboard_base',(0,0,.045),(.65,.43,.055),'ivory')
 box(s,'screen_back',(0,.19,.25),(.64,.04,.43),'wood_light');box(s,'screen',(0,.164,.25),(.57,.009,.36),'screen')
 for row in range(3):
  for col in range(8):box(s,f'key_{row}_{col}',(-.25+col*.07,-.12+row*.08,.077),(.045,.043,.006),'wood_light')
 return s

def keyboard():
 s=scene();rounded(s,'body',(0,0,.027),(.53,.18,.055),'ivory')
 for i in range(7):
  for j in range(2):box(s,f'key_{i}_{j}',(-.21+i*.07,-.045+j*.075,.059),(.047,.046,.008),'wood_light')
 return s

def mouse():
 s=scene();orb(s,'mouse',(0,0,.035),(.065,.10,.045),'ivory');box(s,'seam',(0,-.012,.077),(.008,.05,.003),'wood');return s

def lamp():
 s=scene();cyl(s,'base',(0,0,.035),.16,.07,'wood');rod(s,'lower',(0,0,.07),(.12,0,.40),.025,'metal');rod(s,'upper',(.12,0,.40),(-.04,0,.70),.025,'metal')
 orb(s,'shade',(-.08,0,.70),(.19,.17,.14),'mustard');orb(s,'bulb',(-.08,0,.58),(.085,.085,.045),'warm_white');return s

def mug():
 s=scene();cyl(s,'cup',(0,0,.10),.09,.20,'lavender');cyl(s,'coffee_surface',(0,0,.202),.072,.004,'coffee')
 for i in range(6):
  a=math.pi*(i/5-.5);orb(s,f'handle_{i}',(.115+.065*math.cos(a),0,.105+.08*math.sin(a)),(.025,.027,.025),'lavender',1)
 return s

def books():
 s=scene()
 for i,(col,z) in enumerate([('sage',.045),('pink',.13),('blue',.215),('mustard',.30)]):
  box(s,f'book_{i}',(.03*i,0,z),(.37,.27,.075),col)
  box(s,f'pages_{i}',(.03*i,-.013,z),(.32,.27,.040),'paper')
 return s

def stationery():
 s=scene();cyl(s,'pencil_cup',(0,0,.09),.09,.18,'peach')
 for i in range(5):
  x=(i-2)*.027;rod(s,f'pen_{i}',(x,0,.10),(x+.025,0,.31+i*.018),.009,['sage','wood','blue','terracotta','dark'][i])
 return s

def pot_plant(size='desk'):
 s=scene();k=.58 if size=='desk' else 1.0
 cyl(s,'terracotta_pot',(0,0,.18*k),.18*k,.36*k,'terracotta')
 cyl(s,'pot_rim',(0,0,.355*k),.20*k,.06*k,'wood_dark')
 cyl(s,'soil',(0,0,.39*k),.17*k,.008*k,'wood_dark')
 for i in range(9 if size=='floor' else 6):
  a=i*2.399;rad=(.20+.08*(i%3))*k; z=(.58+.09*(i%4))*k
  rod(s,f'stem_{i}',(0,0,.38*k),(rad*math.cos(a),rad*math.sin(a),z),.012*k,'sage_dark')
  leaf(s,f'leaf_{i}',(rad*math.cos(a),rad*math.sin(a),z),(.10*k,.17*k,.075*k),'leaf_light' if i%3==0 else 'leaf',a)
 return s

def bouquet():
 s=scene();cyl(s,'vase',(0,0,.20),.12,.36,'blue')
 for i in range(7):
  a=i*2*math.pi/7; p=(.19*math.cos(a),.19*math.sin(a),.62+(.03 if i%2 else 0))
  rod(s,f'stem_{i}',(0,0,.32),p,.012,'sage_dark')
  for j in range(5):
   t=j*2*math.pi/5;orb(s,f'petal_{i}_{j}',(p[0]+.052*math.cos(t),p[1]+.052*math.sin(t),p[2]),(.055,.055,.045),['pink','ivory','mustard'][i%3],1)
  orb(s,f'center_{i}',p,(.033,.033,.035),'wood_dark',1)
 return s

def cactus():
 s=scene();cyl(s,'pot',(0,0,.16),.15,.32,'wood_light');orb(s,'cactus_main',(0,0,.42),(.13,.13,.24),'sage_dark')
 for i,x in enumerate([-.13,.13]):orb(s,f'branch_{i}',(x,0,.43),(.08,.09,.14),'sage_dark')
 return s

def wall_art():
 s=scene();box(s,'frame',(0,0,.63),(.70,.05,.94),'wood_dark');box(s,'mat',(0,-.031,.63),(.60,.007,.84),'paper')
 orb(s,'abstract_sun',(-.14,-.042,.81),(.15,.006,.15),'mustard');orb(s,'abstract_hill',(.11,-.045,.40),(.35,.008,.19),'sage')
 return s

def clock():
 s=scene();cyl(s,'round_face',(0,0,.30),.29,.035,'ivory');cyl(s,'rim',(0,0,.30),.31,.012,'wood')
 # dial is horizontal in mesh; scene placement can rotate to wall
 for i in range(12):
  a=2*math.pi*i/12;orb(s,f'index_{i}',(.24*math.cos(a),.24*math.sin(a),.321),(.013,.013,.009),'dark',1)
 rod(s,'hour_hand',(0,0,.329),(.11,.09,.329),.011,'dark');rod(s,'minute_hand',(0,0,.33),(-.06,.20,.33),.008,'dark');return s

def rug():
 s=scene();rounded(s,'rug',(0,0,.017),(2.0,1.35,.035),'ivory')
 for i in range(4):box(s,f'stripe_{i}',(-.67+i*.44,0,.037),(.075,1.15,.004),['sage','pink','mustard','blue'][i])
 return s

def wall_segment():
 s=scene();box(s,'wall',(0,0,1.40),(3.0,.12,2.8),'wall')
 box(s,'baseboard',(0,-.09,.075),(3.0,.07,.15),'wood_light')
 box(s,'trim_top',(0,-.07,2.70),(3.0,.04,.04),'ivory');return s

def wall_window():
 s=wall_segment()
 box(s,'window_recess',(0,-.072,1.63),(1.48,.03,1.16),'wood_light')
 box(s,'glass',(0,-.09,1.63),(1.35,.015,1.02),'glass')
 for x in [-.72,.72]:box(s,f'jamb_{x}',(x,-.11,1.63),(.07,.06,1.23),'ivory')
 for z in [1.04,2.22]:box(s,f'lintel_{z}',(0,-.11,z),(1.49,.06,.07),'ivory')
 box(s,'mullion',(0,-.13,1.63),(.055,.045,1.10),'ivory')
 box(s,'sill',(0,-.18,1.0),(1.65,.22,.055),'wood_light');return s

def wall_door():
 s=wall_segment();box(s,'door_panel',(0,-.10,1.02),(.95,.06,2.04),'wood_light')
 for x in [-.52,.52]:box(s,f'door_jamb_{x}',(x,-.16,1.1),(.06,.08,2.2),'ivory')
 box(s,'door_header',(0,-.16,2.22),(1.1,.08,.06),'ivory')
 orb(s,'door_knob',(.34,-.19,1.05),(.05,.04,.05),'wood_dark');return s

def floor_tile():
 s=scene();box(s,'floor_tile',(0,0,-.055),(3,3,.11),'ivory')
 for i in range(4):box(s,f'wood_seam_{i}',(-1.2+i*.8,0,.001),(.009,3,.002),'wood_light')
 return s

def floor_wood():
 s=scene();box(s,'floor_base',(0,0,-.055),(3,3,.11),'wood_light')
 for i in range(8):box(s,f'plank_seam_{i}',(-1.31+i*.375,0,.001),(.008,3,.002),'wood')
 return s

def wall_corner():
 s=scene();box(s,'wall_x',(0,1.45,1.4),(3,.12,2.8),'wall');box(s,'wall_y',(1.45,0,1.4),(.12,3,2.8),'wall')
 box(s,'baseboard_x',(0,1.35,.075),(3,.065,.15),'wood_light');box(s,'baseboard_y',(1.35,0,.075),(.065,3,.15),'wood_light');return s

def ceiling():
 s=scene();box(s,'ceiling',(0,0,2.86),(3,3,.12),'ivory');return s

def pendant():
 s=scene();rod(s,'cable',(0,0,2.8),(0,0,2.20),.012,'dark');orb(s,'rounded_shade',(0,0,2.18),(.26,.26,.16),'mustard');orb(s,'warm_light',(0,0,2.035),(.09,.09,.045),'warm_white');return s

def floor_lamp():
 s=scene();cyl(s,'base',(0,0,.035),.22,.07,'wood');rod(s,'stand',(0,0,.07),(0,0,1.59),.027,'wood_dark');orb(s,'shade',(0,0,1.55),(.29,.29,.22),'ivory');return s

def divider():
 s=scene();box(s,'fabric_panel',(0,0,.78),(1.25,.065,1.46),'sage')
 for x in [-.64,.64]:box(s,f'post_{x}',(x,0,.79),(.045,.10,1.58),'wood')
 for x in [-.58,.58]:box(s,f'foot_{x}',(x,0,.035),(.24,.40,.07),'wood');return s

def notice_sign():
 s=scene();rounded(s,'plate',(0,0,.20),(.8,.08,.40),'sage')
 for i in range(3):box(s,f'decor_line_{i}',(0,-.052,.29-i*.09),(.49-i*.08,.008,.016),'ivory')
 return s

def box_storage():
 s=scene();rounded(s,'storage_box',(0,0,.22),(.54,.38,.44),'ivory');box(s,'lid',(0,0,.45),(.58,.42,.045),'wood_light')
 box(s,'label',(0,-.205,.24),(.22,.009,.10),'paper');return s

def trash_bin():
 s=scene();cyl(s,'bin_body',(0,0,.20),.17,.39,'sage');cyl(s,'rim',(0,0,.40),.18,.04,'sage_dark');return s

def cushion():
 s=scene();orb(s,'soft_cushion',(0,0,.115),(.28,.28,.115),'pink');orb(s,'center_button',(0,0,.228),(.025,.025,.012),'ivory',1);return s

ASSETS={
'office_desk':('Furniture',(1.4,.75,.78),'Work desk',desk),
'wood_chair':('Furniture',(.58,.61,1.22),'Soft chair',chair),
'office_swivel_chair':('Furniture',(.7,.7,1.18),'Caster chair',swivel),
'round_stool':('Furniture',(.6,.6,.70),'Round stool',stool),
'meeting_table':('Furniture',(2.3,1.1,.80),'Six seat table',meeting_table),
'drawer_cabinet':('Furniture',(.9,.48,1.44),'Three drawers',cabinet),
'bookshelf':('Furniture',(1.04,.42,1.94),'Open shelving',shelf),
'sofa':('Furniture',(1.9,.76,1.19),'Two seat sofa',sofa),
'side_table':('Furniture',(.72,.72,.59),'Round side table',side_table),
'whiteboard':('Office',(1.76,.23,1.70),'Floor stand whiteboard',whiteboard),
'pinboard':('Office',(1.2,.09,1.27),'Wall decor with notes',pinboard),
'monitor':('Desk object',(.8,.26,1.15),'Desktop display',monitor),
'laptop':('Desk object',(.65,.45,.48),'Open laptop',laptop),
'keyboard':('Desk object',(.53,.18,.07),'Separate keys',keyboard),
'mouse':('Desk object',(.13,.2,.08),'Desk mouse',mouse),
'desk_lamp':('Desk object',(.35,.34,.84),'Task lamp',lamp),
'coffee_mug':('Desk object',(.25,.18,.21),'Cup and handle',mug),
'book_stack':('Desk object',(.46,.27,.35),'Four books',books),
'pen_cup':('Desk object',(.18,.18,.34),'Five colored pens',stationery),
'desk_plant':('Plants',(.35,.35,.53),'Mini leafy plant',lambda:pot_plant('desk')),
'floor_plant':('Plants',(.65,.65,.96),'Leafy potted plant',lambda:pot_plant('floor')),
'flower_vase':('Plants',(.5,.5,.73),'Seven stylized flowers',bouquet),
'cactus':('Plants',(.42,.42,.68),'Potted cactus',cactus),
'framed_art':('Decor',(.70,.1,1.10),'Wall art',wall_art),
'wall_clock':('Decor',(.63,.63,.34),'Rotate to mount',clock),
'area_rug':('Decor',(2,1.35,.04),'Striped textile',rug),
'cushion':('Decor',(.56,.56,.23),'Accent cushion',cushion),
'floor_lamp':('Lighting',(.58,.58,1.78),'Standing lamp',floor_lamp),
'pendant_light':('Lighting',(.52,.52,2.8),'Hanging light; ceiling at 2.8',pendant),
'wall_3m':('Architecture',(3,.12,2.8),'Modular wall segment',wall_segment),
'wall_with_window_3m':('Architecture',(3,.3,2.8),'Decorative glazed window wall',wall_window),
'wall_with_door_3m':('Architecture',(3,.2,2.8),'Decorative door wall',wall_door),
'corner_walls_3m':('Architecture',(3,3,2.8),'Two adjoining walls',wall_corner),
'floor_ivory_3m':('Architecture',(3,3,.11),'Modular tile at Z=0',floor_tile),
'floor_wood_3m':('Architecture',(3,3,.11),'Wood floor at Z=0',floor_wood),
'ceiling_3m':('Architecture',(3,3,.12),'Ceiling at 2.86',ceiling),
'room_divider':('Architecture',(1.4,.4,1.6),'Moveable divider',divider),
'notice_sign':('Decor',(.8,.08,.4),'Blank abstract sign; no text',notice_sign),
'storage_box':('Storage',(.58,.42,.48),'Lidded box',box_storage),
'trash_bin':('Storage',(.36,.36,.42),'Small bin',trash_bin),
}
for name,(category,dim,note,fn) in ASSETS.items():scenes[name]=save(name,fn(),category,dim,note)

# A compact workspace example; entities remain individually named and movable.
room=scene()
def place(asset,prefix,pos):
 for key,geo in scenes[asset].geometry.items():
  g=geo.copy();g.apply_translation(pos);room.add_geometry(g,geom_name=prefix+'__'+key)
place('floor_wood_3m','floor',(0,0,0))
place('wall_with_window_3m','back_wall',(0,1.44,0))
# Right wall is rotated 90 degrees so it meets the back wall.
for key,geo in scenes['wall_3m'].geometry.items():
 g=geo.copy();g.apply_transform(trimesh.transformations.rotation_matrix(math.pi/2,[0,0,1]));g.apply_translation((1.44,0,0));room.add_geometry(g,geom_name='right_wall__'+key)
place('area_rug','rug',(0,-.45,.01))
place('office_desk','desk',(0,.30,0));place('office_swivel_chair','chair',(0,-.65,0))
place('laptop','laptop',(-.28,.19,.78));place('coffee_mug','cup',(.43,-.12,.78))
place('desk_plant','small_plant',(.55,.40,.78));place('floor_plant','big_plant',(-1.12,.74,0))
place('bookshelf','shelf',(-1.14,1.03,0));place('floor_lamp','lamp',(1.13,.95,0))
room.export(A/'sample_workspace.glb')
with (P/'asset_catalog.csv').open('w',newline='') as f:
 w=csv.writer(f);w.writerow(['asset','category','width_m','depth_m','height_m','description','bytes']);w.writerows(entries)
(P/'README.md').write_text('''# Dinur AI Office · 3D environment pack

40 individually importable GLB assets plus `sample_workspace.glb`, source script and catalog. Palette and proportions complement the character set. Individual meshes have meaningful names for recoloring and rearrangement. The sample workspace is a staging example.

## Use
- Import GLB into Blender, Godot, Unity, Three.js, or another glTF compatible editor.
- Units are meters; Z is up. Furniture faces negative Y. Most objects have their base at Z=0; desk objects have their base close to Z=0 and should be placed on the desk at Z≈0.78 m.
- Tile 3 m floors and walls. For a room corner, rotate wall segments as needed. `wall_with_window_3m` and `wall_with_door_3m` use surface overlays for editability: they are decorative modules, not physically cut openings.
- Change colors, sizes and positions in `build_office_assets.py`, then rerun `python build_office_assets.py` with numpy and trimesh installed.
- Static meshes only. No lighting engine setup, textures, rigging, collision meshes, or animations. Materials are embedded vertex colors. The flower and leaf shapes are stylized approximations.

## Suggested compatible palette
Ivory #F6F0E0 · wood #B78F65 · sage #99AF8B · lavender #BCA9C9 · dusty pink #E5AAA8 · mustard #CDB573. The pack is an original interpretation of the supplied character image.
''')
with zipfile.ZipFile(P/'dinur_office_3d_environment_pack.zip','w',zipfile.ZIP_DEFLATED) as z:
 for p in sorted(P.rglob('*')):
  if p.is_file() and p.suffix!='.zip':z.write(p,p.relative_to(P))
print('assets',len(entries),'zip',(P/'dinur_office_3d_environment_pack.zip').stat().st_size)
