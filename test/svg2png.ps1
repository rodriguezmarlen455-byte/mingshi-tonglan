param(
  [string]$Svg = 'D:\AI\_crops\chart.svg',
  [string]$Out = 'D:\AI\_crops\chart.png',
  [double]$Scale = 1.6
)
Add-Type -AssemblyName System.Drawing
$raw = [System.IO.File]::ReadAllText($Svg)
$vb = [regex]::Match($raw, 'viewBox="0 0 ([\d.]+) ([\d.]+)"')
$CVW = [double]$vb.Groups[1].Value; $CVH = [double]$vb.Groups[2].Value
$bmp = New-Object System.Drawing.Bitmap ([int]($CVW * $Scale)), ([int]($CVH * $Scale))
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'
$g.TextRenderingHint = 'AntiAlias'
$g.Clear([System.Drawing.Color]::FromArgb(255, 255, 255))
$g.ScaleTransform($Scale, $Scale)

function Cv($c) {
  if ($c -match '^rgba\((\d+),(\d+),(\d+),([\d.]+)\)$') {
    $a = [double]$matches[4]
    $r = [int]([int]$matches[1] * $a + 255 * (1 - $a))
    $gg = [int]([int]$matches[2] * $a + 255 * (1 - $a))
    $b = [int]([int]$matches[3] * $a + 255 * (1 - $a))
    return [System.Drawing.Color]::FromArgb(255, $r, $gg, $b)
  }
  if ($c -match '^rgb\((\d+),(\d+),(\d+)\)$') {
    return [System.Drawing.Color]::FromArgb(255, [int]$matches[1], [int]$matches[2], [int]$matches[3])
  }
  if ($c -match '^#([0-9a-fA-F]{6})$') { return [System.Drawing.ColorTranslator]::FromHtml($c) }
  return [System.Drawing.Color]::Black
}
function Attr($s, $n) {
  $m = [regex]::Match($s, "$n=`"([^`"]*)`"")
  if ($m.Success) { return $m.Groups[1].Value } else { return $null }
}

# 按文档顺序绘制，忠实还原遮挡关系
$haloBrush = New-Object System.Drawing.SolidBrush (Cv '#fffdf8')
foreach ($m in [regex]::Matches($raw, '<(rect|line|circle|text)\b([^>]*)>([^<]*)')) {
  $tag = $m.Groups[1].Value; $s = $m.Groups[2].Value; $inner = $m.Groups[3].Value
  switch ($tag) {
    'rect' {
      $rx = [double](Attr $s 'x'); $ry = [double](Attr $s 'y')
      $rw = [double](Attr $s 'width'); $rh = [double](Attr $s 'height')
      $f = Attr $s 'fill'; $st = Attr $s 'stroke'; $sw = Attr $s 'stroke-width'
      if ($f) { $br = New-Object System.Drawing.SolidBrush (Cv $f); $g.FillRectangle($br, [single]$rx, [single]$ry, [single]$rw, [single]$rh); $br.Dispose() }
      if ($st) { $p = New-Object System.Drawing.Pen (Cv $st), ([single]([double]$sw)); $g.DrawRectangle($p, [single]$rx, [single]$ry, [single]$rw, [single]$rh); $p.Dispose() }
    }
    'line' {
      $x1 = [double](Attr $s 'x1'); $y1 = [double](Attr $s 'y1')
      $x2 = [double](Attr $s 'x2'); $y2 = [double](Attr $s 'y2')
      $st = Attr $s 'stroke'; $sw = Attr $s 'stroke-width'
      if ($st) {
        $p = New-Object System.Drawing.Pen (Cv $st), ([single]([double]$sw))
        $op = Attr $s 'opacity'; if ($op) { $p.Color = [System.Drawing.Color]::FromArgb([int](255 * [double]$op), $p.Color) }
        $g.DrawLine($p, [single]$x1, [single]$y1, [single]$x2, [single]$y2); $p.Dispose()
      }
    }
    'circle' {
      $ccx = [double](Attr $s 'cx'); $ccy = [double](Attr $s 'cy'); $cr = [double](Attr $s 'r')
      $f = Attr $s 'fill'
      if ($f) { $br = New-Object System.Drawing.SolidBrush (Cv $f); $g.FillEllipse($br, [single]($ccx - $cr), [single]($ccy - $cr), [single]($cr * 2), [single]($cr * 2)); $br.Dispose() }
    }
    'text' {
      $t = $inner
      if ($t.Trim() -ne '') {
        $tx = [double](Attr $s 'x'); $ty = [double](Attr $s 'y')
        $fs = [double](Attr $s 'font-size'); if (-not $fs) { $fs = 10 }
        $fill = Attr $s 'fill'; if (-not $fill) { $fill = '#333333' }
        $anchor = Attr $s 'text-anchor'
        $halo = Attr $s 'stroke'
        $font = New-Object System.Drawing.Font 'Microsoft YaHei', ([single]($fs * 0.98)), ([System.Drawing.FontStyle]::Regular), ([System.Drawing.GraphicsUnit]::Pixel)
        $sz = $g.MeasureString($t, $font)
        $px = $tx; if ($anchor -eq 'middle') { $px = $tx - $sz.Width / 2 } elseif ($anchor -eq 'end') { $px = $tx - $sz.Width }
        if ($halo) {
          # 描边样式仅作提示：代理图不模拟，实际浏览器用 paint-order 渲染
        }
        $br = New-Object System.Drawing.SolidBrush (Cv $fill)
        $g.DrawString($t, $font, $br, [single]$px, [single]($ty - $fs * 0.98))
        $br.Dispose(); $font.Dispose()
      }
    }
  }
}

$g.Dispose()
$bmp.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Output "$Out  ${CVW}x${CVH} -> $([int]($CVW*$Scale))x$([int]($CVH*$Scale))"
