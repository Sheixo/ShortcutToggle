"""Generate original vector artwork and PNGs for the Marketplace submission (Pillow required)."""
from pathlib import Path
from html import escape
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1] / 'marketplace' / 'media'
ROOT.mkdir(parents=True, exist_ok=True)
FONT_ROOT = Path('C:/Windows/Fonts')
BG, CARD, BORDER, WHITE, MUTED = '#151923', '#212838', '#354159', '#f5f7ff', '#aebbd2'
GREEN, RED, AMBER, BLUE = '#8ce5b0', '#ff9baa', '#f3d194', '#8facff'

class Canvas:
    def __init__(self, width=1920, height=960):
        self.width, self.height = width, height
        self.image = Image.new('RGB', (width, height), BG)
        self.draw = ImageDraw.Draw(self.image)
        self.svg = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">', f'<rect width="{width}" height="{height}" fill="{BG}"/>']
    def box(self, xy, radius=24, fill=CARD, outline=None, stroke=2):
        self.draw.rounded_rectangle(xy, radius, fill, outline, stroke)
        x,y,r,b = xy
        self.svg.append(f'<rect x="{x}" y="{y}" width="{r-x}" height="{b-y}" rx="{radius}" fill="{fill or "none"}" stroke="{outline or "none"}" stroke-width="{stroke}"/>')
    def line(self, xy, fill, width=4):
        self.draw.line(xy, fill=fill, width=width)
        x,y,r,b=xy
        self.svg.append(f'<line x1="{x}" y1="{y}" x2="{r}" y2="{b}" stroke="{fill}" stroke-width="{width}"/>')
    def text(self, xy, value, size=32, fill=WHITE, bold=False):
        font_path=FONT_ROOT/('segoeuib.ttf' if bold else 'segoeui.ttf')
        font=ImageFont.truetype(str(font_path),size)
        self.draw.text(xy,value,font=font,fill=fill,anchor='lt')
        x,y=xy
        self.svg.append(f'<text x="{x}" y="{y}" dominant-baseline="text-before-edge" fill="{fill}" font-family="Segoe UI,Arial,sans-serif" font-size="{size}" font-weight="{700 if bold else 400}">{escape(value)}</text>')
    def keyboard(self,x,y,scale=1,color=WHITE):
        self.box((x,y,x+220*scale,y+140*scale),18*scale,fill=None,outline=color,stroke=max(2,int(7*scale)))
        for row in range(2):
            for col in range(5):
                self.box((x+(25+37*col)*scale,y+(25+32*row)*scale,x+(45+37*col)*scale,y+(43+32*row)*scale),3*scale,fill=color)
        self.box((x+56*scale,y+91*scale,x+164*scale,y+109*scale),3*scale,fill=color)
    def heading(self,title,subtitle):
        self.text((110,84),'DISCORD SHORTCUTS',25,BLUE,True)
        self.text((110,158),title,62,WHITE,True)
        self.text((110,250),subtitle,30,MUTED)
        self.line((110,856,1810,856),BORDER,2)
        self.text((110,889),'Stream Deck companion · Requires ShortcutToggle for Vencord · Windows',23,MUTED)
    def save(self,name):
        self.image.save(ROOT/(name+'.png'),optimize=True)
        (ROOT/(name+'.svg')).write_text('\n'.join(self.svg+['</svg>']),encoding='utf-8')

c=Canvas()
c.text((110,116),'STREAM DECK COMPANION',25,BLUE,True)
c.text((110,217),'Discord',104,WHITE,True)
c.text((110,352),'Shortcuts',104,WHITE,True)
c.text((110,527),'Control your selected Discord keybinds.',32,MUTED)
c.text((110,586),'See their state at a glance.',32,MUTED)
c.box((1180,160,1765,770),40,outline=BORDER)
c.keyboard(1315,236,1.4)
c.box((1260,514,1685,615),24,fill='#243c32')
c.text((1434,533),'ON',49,GREEN,True)
c.box((1260,643,1685,717),18,fill='#3f2934')
c.text((1440,654),'OFF',36,RED,True)
c.text((110,873),'Requires ShortcutToggle for Vencord · Windows desktop',25,MUTED)
c.save('thumbnail')

c=Canvas();c.heading('One button. Your Discord shortcuts.','Enable or pause the keybinds you select in ShortcutToggle.')
for x,label,color,note in [(110,'ON',GREEN,'Selected keybinds enabled'),(1000,'OFF',RED,'Selected keybinds paused')]:
    c.box((x,360,x+810,776),30,outline=BORDER)
    c.keyboard(x+68,422,.9,color)
    c.text((x+350,437),label,78,color,True)
    c.text((x+68,666),note,34,WHITE,True)
c.save('gallery-control')

c=Canvas();c.heading('Stay in sync.','Confirmed state, automatic reconnection and a clear offline indicator.')
for x,label,color in [(110,'ON',GREEN),(695,'OFF',RED),(1280,'OFFLINE',AMBER)]:
    c.box((x,364,x+530,757),30,outline=BORDER)
    c.keyboard(x+166,425,.9,color)
    c.text((x+70,634),label,52,color,True)
c.save('gallery-connection')

c=Canvas();c.heading('Version and setup, in one place.','Select the action in Stream Deck to open its settings.')
c.box((110,360,1005,788),28,outline=BORDER)
c.text((152,402),'Installed version',29,MUTED)
c.text((774,402),'0.1.4.0',29,WHITE,True)
c.box((152,475,960,558),8,fill='#34435d',outline=BORDER)
c.text((316,495),'Check for updates',34,WHITE,True)
c.box((156,610,186,640),5,fill=BLUE)
c.text((210,602),'Check automatically',31,WHITE)
c.text((152,690),'Daily checks · Installation from GitHub is manual',24,MUTED)
for y,title,note in [(390,'GitHub project','Source code and downloads'),(532,'Installation guide','Set up Discord and Stream Deck'),(674,'Help and feedback','Report a problem or request a feature')]:
    c.text((1110,y),title,35,BLUE,True)
    c.text((1110,y+58),note,25,MUTED)
c.save('gallery-settings')

c=Canvas(288,288);c.box((8,8,280,280),54,fill='#243451');c.keyboard(44,80,.91,WHITE);c.save('app-icon')
print('Marketplace artwork generated: four 1920x960 PNGs, one 288x288 app icon, and editable SVG sources.')
