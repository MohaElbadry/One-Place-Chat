#!/bin/bash
echo "=== Cache Top 10 ==="
du -sh /home/elbadry_/.cache/* 2>/dev/null | sort -rh | head -n 10
echo ""
echo "=== Downloads Top 10 ==="
du -sh /home/elbadry_/Downloads/* 2>/dev/null | sort -rh | head -n 10
