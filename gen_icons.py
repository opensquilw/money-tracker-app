from PIL import Image, ImageDraw

def draw_icon(size, pad_ratio=0.0):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    bg = (95, 187, 151, 255)      # mint green
    can_body = (255, 251, 242, 255)   # cream
    can_lid = (240, 173, 78, 255)     # warm orange lid
    can_line = (95, 187, 151, 255)
    coin = (240, 173, 78, 255)
    coin_text = (255, 251, 242, 255)

    # background rounded square
    r = int(size * 0.22)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=r, fill=bg)

    # can body (jar)
    cx = size / 2
    body_w = size * 0.52
    body_top = size * 0.36
    body_bottom = size * 0.82
    body_left = cx - body_w / 2
    body_right = cx + body_w / 2
    body_r = size * 0.06
    d.rounded_rectangle([body_left, body_top, body_right, body_bottom], radius=body_r, fill=can_body, outline=can_line, width=max(2, size // 60))

    # lid
    lid_h = size * 0.09
    lid_w = body_w * 1.08
    lid_left = cx - lid_w / 2
    lid_right = cx + lid_w / 2
    d.rounded_rectangle([lid_left, body_top - lid_h * 0.6, lid_right, body_top + lid_h * 0.5], radius=lid_h * 0.4, fill=can_lid)

    # coin slot on lid
    slot_w = size * 0.16
    slot_h = size * 0.035
    d.rounded_rectangle([cx - slot_w / 2, body_top - lid_h * 0.35, cx + slot_w / 2, body_top - lid_h * 0.35 + slot_h], radius=slot_h / 2, fill=bg)

    # coin ($ symbol) inside can
    coin_r = size * 0.13
    coin_cy = size * 0.6
    d.ellipse([cx - coin_r, coin_cy - coin_r, cx + coin_r, coin_cy + coin_r], fill=coin)

    # dollar sign
    try:
        from PIL import ImageFont
        font = None
        for fp in ["/System/Library/Fonts/Supplemental/Arial Bold.ttf", "/System/Library/Fonts/Helvetica.ttc"]:
            try:
                font = ImageFont.truetype(fp, int(coin_r * 1.3))
                break
            except Exception:
                continue
        if font:
            text = "$"
            bbox = d.textbbox((0, 0), text, font=font)
            tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
            d.text((cx - tw / 2 - bbox[0], coin_cy - th / 2 - bbox[1]), text, font=font, fill=coin_text)
    except Exception:
        pass

    return img

for size, name in [(192, "icon-192.png"), (512, "icon-512.png"), (180, "apple-touch-icon.png")]:
    img = draw_icon(size)
    img.save(f"/Users/haileychi/money-tracker-app/icons/{name}")

print("done")
