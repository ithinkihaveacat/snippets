/*
 * Copyright 2025 The Android Open Source Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.example.wear.snippets.tile

import android.annotation.SuppressLint
import androidx.annotation.OptIn
import androidx.wear.protolayout.DimensionBuilders
import androidx.wear.protolayout.DimensionBuilders.degrees
import androidx.wear.protolayout.DimensionBuilders.dp
import androidx.wear.protolayout.LayoutElementBuilders
import androidx.wear.protolayout.LayoutElementBuilders.Arc
import androidx.wear.protolayout.LayoutElementBuilders.ArcLine
import androidx.wear.protolayout.ModifiersBuilders
import androidx.wear.protolayout.ModifiersBuilders.AnimatedVisibility
import androidx.wear.protolayout.ModifiersBuilders.DefaultContentTransitions
import androidx.wear.protolayout.ModifiersBuilders.Modifiers
import androidx.wear.protolayout.TimelineBuilders.Timeline
import androidx.wear.protolayout.TypeBuilders.FloatProp
import androidx.wear.protolayout.expression.AnimationParameterBuilders.AnimationParameters
import androidx.wear.protolayout.expression.AnimationParameterBuilders.AnimationSpec
import androidx.wear.protolayout.expression.DynamicBuilders.DynamicFloat
import androidx.wear.protolayout.expression.PlatformEventSources
import androidx.wear.protolayout.expression.ProtoLayoutExperimental
import androidx.wear.protolayout.material.CircularProgressIndicator
import androidx.wear.protolayout.material.Text
import androidx.wear.protolayout.material.layouts.EdgeContentLayout
import androidx.wear.protolayout.material3.dynamicColorScheme
import androidx.wear.tiles.RequestBuilders
import androidx.wear.tiles.TileBuilders.Tile
import androidx.wear.tiles.TileService
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture

private const val RESOURCES_VERSION = "1"
private const val someTileText = "Hello"

private fun getTileTextToShow(): String {
    return "Some text"
}

/** Demonstrates a sweep transition animation on a [CircularProgressIndicator]. */
class AnimationSweepTransition : TileService() {

    // [START android_wear_tile_animations_sweep_transition]
    override fun onTileRequest(requestParams: RequestBuilders.TileRequest): ListenableFuture<Tile> {
        // Define the animation specification.
        val animationSpec = AnimationSpec.Builder()
            .setAnimationParameters(
                AnimationParameters.Builder()
                    .setDurationMillis(2000L) // 2 seconds
                    .build()
            )
            .build()

        // Create a dynamic float that changes from 0.0 to 1.0 when the layout
        // becomes visible, and apply the animation to that change.
        val animatedProgress = DynamicFloat
            .onCondition(PlatformEventSources.isLayoutVisible())
            .use(1.0f) // Value when visible
            .elseUse(0.0f) // Value when not visible
            .animate(animationSpec)

        // Build the indicator, using the animated progress.
        val circularProgressIndicator =
            CircularProgressIndicator.Builder()
                .setProgress(
                    FloatProp.Builder(0.0f) // Initial static value
                        .setDynamicValue(animatedProgress)
                        .build()
                )
                .build()

        return Futures.immediateFuture(
            Tile.Builder()
                .setTileTimeline(Timeline.fromLayoutElement(circularProgressIndicator))
                .build()
        )
    }
    // [END android_wear_tile_animations_sweep_transition]
}

/** Demonstrates setting the growth direction of an [Arc] and [ArcLine]. */
@OptIn(ProtoLayoutExperimental::class)
@SuppressLint("RestrictedApi")
class AnimationArcDirection : TileService() {
    // [START android_wear_tile_animations_set_arc_direction]
    public override fun onTileRequest(
        requestParams: RequestBuilders.TileRequest
    ): ListenableFuture<Tile> {
        // Define the animation specification.
        val animationSpec = AnimationSpec.Builder()
            .setAnimationParameters(
                AnimationParameters.Builder()
                    .setDurationMillis(2000L) // 2 seconds
                    .build()
            )
            .build()

        // Create a dynamic float that changes from 0f to 240f when the layout
        // becomes visible, and apply the animation to that change.
        val animatedAngle = DynamicFloat
            .onCondition(PlatformEventSources.isLayoutVisible())
            .use(240f)
            .elseUse(0f)
            .animate(animationSpec)

        // Set the dynamic value to the ArcLine's length.
        val animatedLength = DimensionBuilders.DegreesProp.Builder(0f)
            .setDynamicValue(animatedAngle)
            .build()

        val animatedArcLine = ArcLine.Builder()
            .setLength(animatedLength)
            .setThickness(dp(6f))
            .setColor(dynamicColorScheme(this).onPrimaryContainer.prop)
            .setArcDirection(LayoutElementBuilders.ARC_DIRECTION_CLOCKWISE)
            .build()

        // The Arc grows counter-clockwise, but the line within it grows
        // clockwise.
        val arc = Arc.Builder()
            .setArcDirection(LayoutElementBuilders.ARC_DIRECTION_COUNTER_CLOCKWISE)
            .addContent(animatedArcLine)
            .build()

        val layout = EdgeContentLayout.Builder(requestParams.deviceConfiguration)
            .setResponsiveContentInsetEnabled(true)
            .setEdgeContent(arc)
            .build()

        return Futures.immediateFuture(
            Tile.Builder()
                .setTileTimeline(Timeline.fromLayoutElement(layout))
                .build()
        )
    }
    // [END android_wear_tile_animations_set_arc_direction]
}

/** Demonstrates smooth fade-in and fade-out transitions. */
class AnimationFadeTransition : TileService() {

    @OptIn(ProtoLayoutExperimental::class)
    // [START android_wear_tile_animations_fade]
    public override fun onTileRequest(
        requestParams: RequestBuilders.TileRequest
    ): ListenableFuture<Tile> {
        // Assumes that you've defined a custom helper method called
        // getTileTextToShow().
        val tileText = getTileTextToShow()
        return Futures.immediateFuture(
            Tile.Builder()
                .setResourcesVersion(RESOURCES_VERSION)
                .setTileTimeline(
                    Timeline.fromLayoutElement(
                        Text.Builder(this, tileText)
                            .setModifiers(
                                Modifiers.Builder()
                                    .setContentUpdateAnimation(
                                        AnimatedVisibility.Builder()
                                            .setEnterTransition(DefaultContentTransitions.fadeIn())
                                            .setExitTransition(DefaultContentTransitions.fadeOut())
                                            .build()
                                    )
                                    .build()
                            )
                            .build()
                    )
                )
                .build()
        )
    }
    // [END android_wear_tile_animations_fade]
}

/** Demonstrates smooth slide-in and slide-out transitions. */
class AnimationSlideTransition : TileService() {
    @OptIn(ProtoLayoutExperimental::class)
    // [START android_wear_tile_animations_slide]
    public override fun onTileRequest(
        requestParams: RequestBuilders.TileRequest
    ): ListenableFuture<Tile> {
        // Assumes that you've defined a custom helper method called
        // getTileTextToShow().
        val tileText = getTileTextToShow()
        return Futures.immediateFuture(
            Tile.Builder()
                .setResourcesVersion(RESOURCES_VERSION)
                .setTileTimeline(
                    Timeline.fromLayoutElement(
                        Text.Builder(this, tileText)
                            .setModifiers(
                                Modifiers.Builder()
                                    .setContentUpdateAnimation(
                                        AnimatedVisibility.Builder()
                                            .setEnterTransition(
                                                DefaultContentTransitions.slideIn(
                                                    ModifiersBuilders.SLIDE_DIRECTION_LEFT_TO_RIGHT
                                                )
                                            )
                                            .setExitTransition(
                                                DefaultContentTransitions.slideOut(
                                                    ModifiersBuilders.SLIDE_DIRECTION_LEFT_TO_RIGHT
                                                )
                                            )
                                            .build()
                                    )
                                    .build()
                            )
                            .build()
                    )
                )
                .build()
        )
    }
    // [END android_wear_tile_animations_slide]
}

/** Demonstrates a rotation transformation. */
class AnimationRotation : TileService() {
    override fun onTileRequest(requestParams: RequestBuilders.TileRequest): ListenableFuture<Tile> {
        // [START android_wear_tile_animations_rotation]
        return Futures.immediateFuture(
            Tile.Builder()
                .setResourcesVersion(RESOURCES_VERSION)
                .setTileTimeline(
                    Timeline.fromLayoutElement(
                        Text.Builder(this, someTileText)
                            .setModifiers(
                                Modifiers.Builder()
                                    .setTransformation(
                                        ModifiersBuilders.Transformation.Builder()
                                            // Set the pivot point 50 dp from the left edge
                                            // and 100 dp from the top edge of the screen.
                                            .setPivotX(dp(50f))
                                            .setPivotY(dp(100f))
                                            // Rotate the element 45 degrees clockwise.
                                            .setRotation(degrees(45f))
                                            .build()
                                    )
                                    .build()
                            )
                            .build()
                    )
                )
                .build()
        )
        // [END android_wear_tile_animations_rotation]
    }
}

/** Demonstrates a scaling transformation. */
class AnimationScaling : TileService() {
    override fun onTileRequest(requestParams: RequestBuilders.TileRequest): ListenableFuture<Tile> {
        // [START android_wear_tile_animations_scaling]
        return Futures.immediateFuture(
            Tile.Builder()
                .setResourcesVersion(RESOURCES_VERSION)
                .setTileTimeline(
                    Timeline.fromLayoutElement(
                        Text.Builder(this, someTileText)
                            .setModifiers(
                                Modifiers.Builder()
                                    .setTransformation(
                                        ModifiersBuilders.Transformation.Builder()
                                            // Set the pivot point 50 dp from the left edge
                                            // and 100 dp from the top edge of the screen.
                                            .setPivotX(dp(50f))
                                            .setPivotY(dp(100f))
                                            // Shrink the element by a scale factor
                                            // of 0.5 horizontally and 0.75 vertically.
                                            .setScaleX(FloatProp.Builder(0.5f).build())
                                            .setScaleY(
                                                FloatProp.Builder(0.75f).build()
                                            )
                                            .build()
                                    )
                                    .build()
                            )
                            .build()
                    )
                )
                .build()
        )
        // [END android_wear_tile_animations_scaling]
    }
}

/** Demonstrates a geometric translation. */
class AnimationGeometricTranslation : TileService() {
    override fun onTileRequest(requestParams: RequestBuilders.TileRequest): ListenableFuture<Tile> {
        // [START android_wear_tile_animations_geometric_translation]
        return Futures.immediateFuture(
            Tile.Builder()
                .setResourcesVersion(RESOURCES_VERSION)
                .setTileTimeline(
                    Timeline.fromLayoutElement(
                        Text.Builder(this, someTileText)
                            .setModifiers(
                                Modifiers.Builder()
                                    .setTransformation(
                                        ModifiersBuilders.Transformation.Builder()
                                            // Translate (move) the element 60 dp to the right
                                            // and 80 dp down.
                                            .setTranslationX(dp(60f))
                                            .setTranslationY(dp(80f))
                                            .build()
                                    )
                                    .build()
                            )
                            .build()
                    )
                )
                .build()
        )
        // [END android_wear_tile_animations_geometric_translation]
    }
}
