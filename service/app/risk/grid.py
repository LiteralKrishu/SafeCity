from __future__ import annotations

import math
from dataclasses import dataclass

RISK_GRID_VERSION = "r1"
RISK_GRID_ZOOM = 16
_WORLD_CELLS = 2**RISK_GRID_ZOOM
_MAX_MERCATOR_LATITUDE = 85.05112878
_EARTH_CIRCUMFERENCE_METERS = 40_075_016.686


@dataclass(frozen=True)
class RiskCell:
    cell_id: str
    latitude: float
    longitude: float
    radius_meters: int


def location_to_cell_id(latitude: float, longitude: float) -> str:
    """Convert a precise point to a coarse Web Mercator cell identifier."""
    if not math.isfinite(latitude) or not math.isfinite(longitude):
        raise ValueError("Coordinates must be finite")
    if latitude < -90 or latitude > 90 or longitude < -180 or longitude > 180:
        raise ValueError("Coordinates are outside geographic bounds")

    clipped_latitude = min(max(latitude, -_MAX_MERCATOR_LATITUDE), _MAX_MERCATOR_LATITUDE)
    latitude_radians = math.radians(clipped_latitude)
    x = math.floor(((longitude + 180) / 360) * _WORLD_CELLS)
    y = math.floor(
        (
            1
            - math.asinh(math.tan(latitude_radians)) / math.pi
        )
        / 2
        * _WORLD_CELLS
    )
    x = min(max(x, 0), _WORLD_CELLS - 1)
    y = min(max(y, 0), _WORLD_CELLS - 1)
    return f"{RISK_GRID_VERSION}:{x}:{y}"


def decode_cell_id(cell_id: str) -> RiskCell:
    try:
        version, raw_x, raw_y = cell_id.split(":")
        x = int(raw_x)
        y = int(raw_y)
    except (TypeError, ValueError) as exc:
        raise ValueError("Invalid risk cell identifier") from exc

    if version != RISK_GRID_VERSION or not (0 <= x < _WORLD_CELLS) or not (
        0 <= y < _WORLD_CELLS
    ):
        raise ValueError("Invalid risk cell identifier")

    longitude = ((x + 0.5) / _WORLD_CELLS) * 360 - 180
    mercator_y = math.pi * (1 - 2 * ((y + 0.5) / _WORLD_CELLS))
    latitude = math.degrees(math.atan(math.sinh(mercator_y)))
    cell_width = (
        _EARTH_CIRCUMFERENCE_METERS
        * max(0.05, math.cos(math.radians(latitude)))
        / _WORLD_CELLS
    )
    # A radius covering roughly half the cell diagonal avoids suggesting a pinpoint.
    radius_meters = round(cell_width * math.sqrt(2) / 2)
    return RiskCell(
        cell_id=cell_id,
        latitude=round(latitude, 6),
        longitude=round(longitude, 6),
        radius_meters=max(180, radius_meters),
    )


def cell_is_inside_bbox(
    cell: RiskCell,
    *,
    south: float,
    west: float,
    north: float,
    east: float,
) -> bool:
    return south <= cell.latitude <= north and west <= cell.longitude <= east
