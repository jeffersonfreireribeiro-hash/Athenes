# SPDX-License-Identifier: GPL-3.0-or-later
import cv2
import numpy as np

im = cv2.imread(r'C:/Users/jeffe/.gemini/antigravity/brain/f29036f0-2e77-49fc-a2cc-41686233d4a8/.user_uploaded/media_1793548655329_4305ff6e.png', cv2.IMREAD_GRAYSCALE)
_, thresh = cv2.threshold(im, 200, 255, cv2.THRESH_BINARY_INV)

# Find contours
contours, hierarchy = cv2.findContours(thresh, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)

valid_contours = [c for c in contours if len(c) > 5 and cv2.contourArea(c) > 50]

all_pts = np.vstack([c.reshape(-1, 2) for c in valid_contours])
min_x, min_y = all_pts.min(axis=0)
max_x, max_y = all_pts.max(axis=0)
orig_w = max_x - min_x
orig_h = max_y - min_y

# Scale to fit into 24x24 box with 1px padding
scale = 21.0 / max(orig_w, orig_h)
target_w = orig_w * scale
target_h = orig_h * scale
offset_x = (24.0 - target_w) / 2.0
offset_y = (24.0 - target_h) / 2.0

def contour_to_norm_path(cnt):
    pts = cnt.reshape(-1, 2)
    norm_pts = []
    for p in pts:
        nx = float((p[0] - min_x) * scale + offset_x)
        ny = float((p[1] - min_y) * scale + offset_y)
        norm_pts.append([nx, ny])
    
    cnt_arr = np.array(norm_pts, dtype=np.float32)
    approx = cv2.approxPolyDP(cnt_arr, 0.08, True).reshape(-1, 2)
    if len(approx) < 3:
        return ''
    
    d = f"M{approx[0][0]:.2f} {approx[0][1]:.2f}"
    for p in approx[1:]:
        d += f"L{p[0]:.2f} {p[1]:.2f}"
    d += "Z"
    return d

norm_paths = [contour_to_norm_path(c) for c in valid_contours if contour_to_norm_path(c)]
full_d = " ".join(norm_paths)

# Also generate 512x512 SVG
scale_512 = 460.0 / max(orig_w, orig_h)
tw_512 = orig_w * scale_512
th_512 = orig_h * scale_512
ox_512 = (512.0 - tw_512) / 2.0
oy_512 = (512.0 - th_512) / 2.0

def contour_to_512_path(cnt):
    pts = cnt.reshape(-1, 2)
    pts_512 = []
    for p in pts:
        nx = float((p[0] - min_x) * scale_512 + ox_512)
        ny = float((p[1] - min_y) * scale_512 + oy_512)
        pts_512.append([nx, ny])
    cnt_arr = np.array(pts_512, dtype=np.float32)
    approx = cv2.approxPolyDP(cnt_arr, 0.6, True).reshape(-1, 2)
    if len(approx) < 3:
        return ''
    d = f"M{approx[0][0]:.1f} {approx[0][1]:.1f}"
    for p in approx[1:]:
        d += f"L{p[0]:.1f} {p[1]:.1f}"
    d += "Z"
    return d

paths_512 = [contour_to_512_path(c) for c in valid_contours if contour_to_512_path(c)]

svg_standalone = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <path fill="#314F79" fill-rule="evenodd" d="{' '.join(paths_512)}" />
</svg>'''

with open('src/ui/athenes_logo.svg', 'w', encoding='utf-8') as f:
    f.write(svg_standalone)

with open('tools/logo_path_24.txt', 'w', encoding='utf-8') as f:
    f.write(full_d)

print(f"Sucesso! Logo 24x24 len={len(full_d)}, contours={len(norm_paths)}, 512x512 salvo.")
