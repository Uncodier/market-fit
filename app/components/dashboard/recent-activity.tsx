import { Avatar, AvatarFallback, AvatarImage } from "@/app/components/ui/avatar"

interface Activity {
  id: string
  user: {
    name: string
    email: string
    imageUrl?: string
  }
  action: string
  date: string
  segment?: string
  experiment?: string
}

const activities: Activity[] = [
  {
    id: "1",
    user: {
      name: "John Smith",
      email: "john@example.com",
      imageUrl: "/avatars/01.png",
    },
    action: "Created a new segment",
    segment: "Enterprise Decision Makers",
    date: "2024-01-20",
  },
  {
    id: "2",
    user: {
      name: "Sarah Johnson",
      email: "sarah@example.com",
      imageUrl: "/avatars/02.png",
    },
    action: "Started an experiment",
    experiment: "Homepage Redesign",
    date: "2024-01-19",
  },
  {
    id: "3",
    user: {
      name: "Michael Chen",
      email: "michael@example.com",
      imageUrl: "/avatars/03.png",
    },
    action: "Updated segment criteria",
    segment: "Small Business Owners",
    date: "2024-01-18",
  },
  {
    id: "4",
    user: {
      name: "Emily Rodriguez",
      email: "emily@example.com",
      imageUrl: "/avatars/04.png",
    },
    action: "Completed experiment",
    experiment: "Pricing Page Test",
    date: "2024-01-17",
  },
  {
    id: "5",
    user: {
      name: "David Kim",
      email: "david@example.com",
      imageUrl: "/avatars/05.png",
    },
    action: "Created a new segment",
    segment: "Marketing Professionals",
    date: "2024-01-16",
  },
]

export function RecentActivity() {
  return (
    <div className="space-y-8">
      {activities.map((activity) => (
        <div className="flex items-center" key={activity.id}>
          <Avatar className="h-9 w-9">
            <AvatarImage src={activity.user.imageUrl} alt={activity.user.name} />
            <AvatarFallback>
              {activity.user.name.split(" ").map(name => name[0]).join("")}
            </AvatarFallback>
          </Avatar>
          <div className="ml-4 space-y-1">
            <p className="text-sm font-medium leading-none">
              {activity.user.name}
            </p>
            <p className="text-sm text-muted-foreground">
              {activity.action}{" "}
              {activity.segment && <span className="font-medium">{activity.segment}</span>}
              {activity.experiment && <span className="font-medium">{activity.experiment}</span>}
            </p>
          </div>
          <div className="ml-auto text-sm text-muted-foreground">
            {new Date(activity.date).toLocaleDateString()}
          </div>
        </div>
      ))}
    </div>
  )
} 