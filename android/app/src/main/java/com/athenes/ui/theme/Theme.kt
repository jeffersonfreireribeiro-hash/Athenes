package com.athenes.ui.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.lightColorScheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

private val LightColorScheme = lightColorScheme(
    primary = AthenesPrimary,
    onPrimary = AthenesSurface,
    primaryContainer = AthenesPrimarySoft,
    onPrimaryContainer = AthenesPrimaryDark,
    secondary = AthenesPrimaryDark,
    background = AthenesBg,
    surface = AthenesSurface,
    onSurface = AthenesText,
    outline = AthenesBorder,
    outlineVariant = AthenesBorderSubtle
)

private val DarkColorScheme = darkColorScheme(
    primary = Color(0xFFB4C9EA),
    onPrimary = Color(0xFF172D4D),
    primaryContainer = AthenesPrimary,
    onPrimaryContainer = Color.White,
    secondary = Color(0xFFB4C9EA),
    background = Color(0xFF111827),
    surface = Color(0xFF1F2937),
    onSurface = Color(0xFFF1F5F9),
    outline = Color(0xFF94A3B8),
    outlineVariant = Color(0xFF475569)
)

val AthenesShapes = Shapes(
    small = RoundedCornerShape(8.dp),
    medium = RoundedCornerShape(12.dp),
    large = RoundedCornerShape(16.dp),
    extraLarge = RoundedCornerShape(999.dp)
)

@Composable
fun AthenesTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = if (isSystemInDarkTheme()) DarkColorScheme else LightColorScheme,
        typography = AthenesTypography,
        shapes = AthenesShapes,
        content = content
    )
}
