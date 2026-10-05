"""Procedural editable character set inspired by supplied 2D reference.
Run: python build_characters.py  (requires numpy and trimesh)
Coordinate system: Z up, front faces -Y. Units are arbitrary game units.
"""
import math, os, zipfile
import numpy as np
import trimesh
from trimesh.transformations import translation_matrix

OUT=os.path.dirname(__file__)
SKIN={'light':(225,181,130,255),'peach':(238,190,162,255),'tan':(182,112,68,255),'deep':(151,85,48,255)}
C={'cream':(242,231,209,255),'ivory':(247,239,225,255),'olive':(68,76,62,255),'sage':(157,178,129,255),'lavender':(187,166,204,255),'pink':(237,161,170,255),'brown':(78,44,31,255),'darkbrown':(48,28,23,255),'black':(40,37,36,255),'gold':(194,149,91,255),'blue':(124,176,176,255),'orange':(199,101,54,255),'mustard':(196,177,107,255),'blush':(234,166,156,255),'white':(246,242,230,255)}

def mk_scene(): return trimesh.Scene()
def add(scene,name,center,scale,color,sub=2):
    m=trimesh.creation.icosphere(subdivisions=sub,radius=1.0)
    m.apply_scale(scale); m.apply_translation(center)
    m.visual.vertex_colors=np.tile(np.array(color,dtype=np.uint8),(len(m.vertices),1))
    scene.add_geometry(m,geom_name=name,node_name=name)

def box(scene,name,center,size,color):
    m=trimesh.creation.box(extents=size)
    m.apply_translation(center)
    m.visual.vertex_colors=np.tile(np.array(color,dtype=np.uint8),(len(m.vertices),1))
    scene.add_geometry(m,geom_name=name,node_name=name)

def tube(scene,name,a,b,radius,color):
    a=np.array(a,float);b=np.array(b,float);d=b-a
    m=trimesh.creation.cylinder(radius=radius,height=np.linalg.norm(d),sections=16)
    T=trimesh.geometry.align_vectors([0,0,1],d)
    m.apply_transform(T);m.apply_translation((a+b)/2)
    m.visual.vertex_colors=np.tile(np.array(color,dtype=np.uint8),(len(m.vertices),1))
    scene.add_geometry(m,geom_name=name,node_name=name)

def character(key,skin,hair,top,bottom,variant):
    s=mk_scene(); sc=SKIN[skin];hc=C[hair];tc=C[top];bc=C[bottom]
    # Common body system: overall 3 units, oversized head, compact torso.
    add(s,'body_shirt',(0,0,1.18),(.49,.34,.52),tc,3)
    add(s,'neck',(0,0,1.74),(.16,.16,.19),sc)
    add(s,'head_base',(0,0,2.20),(.64,.53,.61),sc,3)
    for side,label in [(-1,'L'),(1,'R')]:
        add(s,'ear_'+label,(side*.61,0,2.19),(.13,.16,.20),sc)
        add(s,'sleeve_'+label,(side*.52,0,1.30),(.20,.31,.37),tc)
        add(s,'hand_'+label,(side*.57,-.015,.91),(.17,.17,.15),sc)
        add(s,'leg_'+label,(side*.22,0,.52),(.21,.25,.40),bc)
        add(s,'shoe_'+label,(side*.22,-.10,.16),(.27,.34,.17),C['white'])
        add(s,'eye_'+label,(side*.25,-.49,2.27),(.082,.038,.13),C['black'],3)
        add(s,'eye_shine_'+label,(side*.23,-.526,2.32),(.018,.012,.026),C['white'])
        add(s,'cheek_'+label,(side*.41,-.436,2.03),(.12,.016,.055),C['blush'])
    add(s,'nose',(0,-.528,2.12),(.045,.027,.035),tuple(int(v*.86) for v in sc[:3])+(255,))
    add(s,'mouth',(0,-.520,1.98),(.055,.025,.025),C['brown'])
    # Sculpted hair cap plus deliberately named individual locks.
    add(s,'hair_cap',(0,.11,2.65),(.64,.52,.25),hc,3)
    for i,x in enumerate([-.47,-.22,.02,.27,.49]):
        add(s,f'fringe_{i}',(x,-.32,2.64),(.20,.22,.16),hc)
    if variant=='curls':
        for side,label in [(-1,'L'),(1,'R')]:
            for i,z in enumerate([2.64,2.42,2.20,1.99]):
                add(s,f'curl_{label}_{i}',(side*.59,.02,z),(.19,.23,.18),hc)
        for i,x in enumerate([-.42,-.15,.14,.41]):
            add(s,f'top_curl_{i}',(x,.00,2.82),(.22,.23,.18),hc)
        for side,label in [(-1,'L'),(1,'R')]:
            add(s,f'glasses_rim_{label}',(side*.25,-.535,2.27),(.145,.036,.16),C['gold'])
            add(s,f'glasses_lens_{label}',(side*.25,-.568,2.27),(.109,.018,.125),(83,57,43,185))
        tube(s,'glasses_bridge',(-.09,-.57,2.28),(.09,-.57,2.28),.025,C['gold'])
        box(s,'designer_shirt_panel',(0,-.348,1.25),(.25,.035,.66),C['cream'])
        box(s,'designer_left_panel',(-.35,-.325,1.25),(.13,.035,.46),C['cream'])
        box(s,'designer_right_panel',(.35,-.325,1.25),(.13,.035,.46),C['cream'])
        tube(s,'designer_waist_seam',(-.37,-.355,.94),(.37,-.355,.94),.027,C['gold'])
    elif variant=='buns':
        for side,label in [(-1,'L'),(1,'R')]:add(s,'hair_bun_'+label,(side*.58,.10,2.77),(.26,.25,.26),hc)
    elif variant=='bob':
        for side,label in [(-1,'L'),(1,'R')]: add(s,'bob_side_'+label,(side*.58,.06,2.29),(.22,.26,.38),hc)
    elif variant=='headphones':
        for side,label in [(-1,'L'),(1,'R')]:add(s,'earcup_'+label,(side*.66,.02,2.36),(.13,.22,.29),C['black'])
        for i in range(9):
            a=math.pi*i/8
            add(s,f'headphone_band_{i}',(.74*math.cos(a),0,2.54+.46*math.sin(a)),(.085,.09,.085),C['black'],1)
    elif variant=='beret':
        add(s,'beret_brim',(0,.02,2.83),(.70,.53,.09),C['sage'])
        add(s,'beret_crown',(0,.02,2.92),(.60,.46,.12),C['sage'])
    elif variant=='cap':
        add(s,'cap_crown',(0,0,2.79),(.64,.51,.19),C['cream'])
        add(s,'cap_brim',(0,-.48,2.71),(.49,.28,.055),C['cream'])
    elif variant=='long':
        for side,label in [(-1,'L'),(1,'R')]:add(s,'long_hair_'+label,(side*.55,.10,2.19),(.20,.26,.49),hc)
    if key=='COPYWRITER':
        add(s,'skirt',(0,0,.77),(.47,.37,.24),C['pink'])
        for side,label in [(-1,'L'),(1,'R')]: add(s,'pink_pigtail_'+label,(side*.61,.08,2.18),(.18,.20,.35),hc)
    if key=='QA':
        box(s,'shirt_front',(0,-.346,1.19),(.28,.035,.52),C['cream'])
    if key in ('OPERATIONS','HR','FINANCE'):
        box(s,'shirt_placket',(0,-.35,1.20),(.15,.034,.58),C['cream'])
        for i in range(3):add(s,f'button_{i}',(0,-.37,1.42-i*.2),(.025,.02,.025),C['gold'],1)
    return s

SPECS=[
 ('OPERATIONS','light','brown','mustard','olive','buns'),
 ('RESEARCH','tan','black','sage','olive','cap'),
 ('COPYWRITER','peach','pink','pink','cream','long'),
 ('DESIGNER','deep','darkbrown','lavender','olive','curls'),
 ('QA','light','gold','blue','olive','beret'),
 ('ANALYST','light','black','mustard','olive','headphones'),
 ('HR','tan','orange','lavender','olive','bob'),
 ('FINANCE','light','brown','sage','blue','beret'),
]
scenes=[]
for spec in SPECS:
    scene=character(*spec); scenes.append(scene)
    scene.export(os.path.join(OUT,spec[0].lower()+'.glb'))

# Separate reference board preserving identities in one editable scene.
lineup=mk_scene()
for index,sc in enumerate(scenes):
    for name,geometry in sc.geometry.items():
        g=geometry.copy();g.apply_translation(((index-3.5)*1.65,0,0))
        lineup.add_geometry(g,geom_name=SPECS[index][0]+'_'+name)
lineup.export(os.path.join(OUT,'dinur_character_lineup.glb'))
with open(os.path.join(OUT,'README.txt'),'w') as f:
    f.write('DINUR AI OFFICE — ORIGINAL 3D CHARACTER BASE SET\n\nEight editable GLB characters plus a lineup GLB. Each named part is an individual mesh (hair locks, eyes, clothing, limbs), suitable for importing into Blender, Godot, Unity, or compatible 3D editors. Z is up and the face looks toward negative Y.\n\nThese are handcrafted procedural 3D approximations guided by a single 2D image. The unseen sides and geometry cannot be recovered exactly from the reference. They are static, unrigged meshes; outfit, pose, and facial controls are not animated. Edit build_characters.py to alter proportions, color, or parts, then rerun it. Python dependencies: numpy, trimesh.\n\nDesigner is the detailed visual anchor. For faithful animation, sculpt refinement and a skeleton/skin rig are the next production stage.\n')
files=[n for n in os.listdir(OUT) if n.endswith('.glb') or n in ('README.txt','build_characters.py')]
with zipfile.ZipFile(os.path.join(OUT,'dinur_3d_character_assets.zip'),'w',zipfile.ZIP_DEFLATED) as z:
    for n in files:z.write(os.path.join(OUT,n),n)
print('Created',files)
