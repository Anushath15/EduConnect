import { Tabs } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { colors } from "../../src/theme"

export default function AppLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarLabelStyle: { fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "home" : "home-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="teachers"
        options={{
          title: "Teachers",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "people" : "people-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="classes"
        options={{
          title: "Classes",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "school" : "school-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="timetable"
        options={{
          title: "Timetable",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "calendar" : "calendar-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="substitutions"
        options={{
          title: "Subs",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "person-remove" : "person-remove-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="swap-requests"
        options={{
          title: "Swaps",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "swap-horizontal" : "swap-horizontal-outline"} size={22} color={color} />
          ),
        }}
      />
      {/* Hidden screens — reachable via router.push() but not shown in tab bar */}
      <Tabs.Screen name="announcements"  options={{ href: null }} />
      <Tabs.Screen name="resources"      options={{ href: null }} />
      <Tabs.Screen name="subjects"       options={{ href: null }} />
      <Tabs.Screen name="periods"        options={{ href: null }} />
      <Tabs.Screen name="audit-logs"     options={{ href: null }} />
      <Tabs.Screen name="attendance"     options={{ href: null }} />
      <Tabs.Screen name="teachers/[id]"  options={{ href: null }} />
      <Tabs.Screen name="classes/index"  options={{ href: null }} />
      <Tabs.Screen name="classes/[id]"   options={{ href: null }} />
      <Tabs.Screen name="students/[id]"  options={{ href: null }} />
    </Tabs>
  )
}