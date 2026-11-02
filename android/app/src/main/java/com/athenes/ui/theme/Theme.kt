package com.athenes.ui.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
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

val AthenesShapes = Shapes(
    small = RoundedCornerShape(8.dp),
    medium = RoundedCornerShape(12.dp),
    large = RoundedCornerShape(16.dp),
    extraLarge = RoundedCornerShape(999.dp)
)

@Composable
fun AthenesTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = LightColorScheme,
        typography = AthenesTypography,
        shapes = AthenesShapes,
        content = content
    )
}
