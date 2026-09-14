import { StyleSheet, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import { Spacing } from "../../constants/theme";

export type PieChartSlice = {
  color: string;
  value: number;
};

type PieChartProps = {
  slices: PieChartSlice[];
  size?: number;
  strokeWidth?: number;
};

/**
 * A donut chart built from stacked, offset Circle strokes -
 * each slice is just a dashed stroke long enough to cover
 * its share of the circumference, rotated to start where
 * the previous slice ended. Avoids hand-computing SVG arc
 * paths for what's always a small, fixed number of slices.
 */
export function PieChart({
  slices,
  size = 160,
  strokeWidth = 28,
}: PieChartProps) {
  const radius =
    (size - strokeWidth) / 2;

  const circumference =
    2 * Math.PI * radius;

  const total = slices.reduce(
    (sum, slice) => sum + slice.value,
    0
  );

  if (total <= 0) {
    return null;
  }

  let offsetSoFar = 0;

  return (
    <View
      style={[
        styles.container,
        { width: size, height: size },
      ]}
    >
      <Svg
        width={size}
        height={size}
      >
        {slices.map((slice, index) => {
          const sliceLength =
            (slice.value / total) *
            circumference;

          const dashOffset =
            -offsetSoFar;

          offsetSoFar += sliceLength;

          return (
            <Circle
              key={index}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={slice.color}
              strokeWidth={
                strokeWidth
              }
              strokeDasharray={`${sliceLength} ${circumference - sliceLength}`}
              strokeDashoffset={
                dashOffset
              }
              fill="none"
              origin={`${size / 2}, ${size / 2}`}
              rotation={-90}
            />
          );
        })}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: Spacing.sm,
  },
});
