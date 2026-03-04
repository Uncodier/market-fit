from PIL import Image
import sys

img_path = '/Users/prado/.cursor/projects/Users-prado-Desktop-Proyectos-Uncodie-Code-market-fit/assets/browser-screenshot-db36a89d-fcb1-4edb-a49a-55cc50ede4cc.png'
img = Image.open(img_path)
width, height = img.size

# Check if there is text by finding non-white pixels
non_white = 0
colors = {}

for y in range(height):
    for x in range(width):
        p = img.getpixel((x, y))
        if isinstance(p, tuple):
            if len(p) >= 3:
                rgb = (p[0], p[1], p[2])
            else:
                rgb = p
        else:
            rgb = (p, p, p)
            
        if rgb != (255, 255, 255):
            non_white += 1
            if rgb not in colors:
                colors[rgb] = 0
            colors[rgb] += 1

print(f"Size: {width}x{height}")
print(f"Non-white pixels: {non_white}")

# sort colors by frequency
sorted_colors = sorted(colors.items(), key=lambda item: item[1], reverse=True)
print("Top colors:")
for c, count in sorted_colors[:10]:
    print(f"RGB: {c}, count: {count}")
    
