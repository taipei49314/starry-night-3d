# Contact sheet: python tools/sheet.py out.png cols w file1 label1 file2 label2 ...
import sys
from PIL import Image, ImageDraw
out, cols, w = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
items = list(zip(sys.argv[4::2], sys.argv[5::2]))
ims = []
for f, label in items:
    im = Image.open(f).convert('RGB')
    h = int(im.height * w / im.width)
    im = im.resize((w, h))
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, 8 * len(label) + 8, 16], fill=(0, 0, 0))
    d.text((4, 2), label, fill=(255, 255, 0))
    ims.append(im)
h = max(i.height for i in ims)
rows = (len(ims) + cols - 1) // cols
sheet = Image.new('RGB', (cols * w, rows * h), (40, 40, 40))
for k, im in enumerate(ims):
    sheet.paste(im, ((k % cols) * w, (k // cols) * h))
sheet.save(out)
print(out, sheet.size)
