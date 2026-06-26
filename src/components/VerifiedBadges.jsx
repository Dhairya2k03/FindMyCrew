import {
    BadgeCheck,
    Gamepad2,
    MessageCircle,
    Monitor,
    Trophy
} from "lucide-react";

export default function VerifiedBadges({
    steamVerified,
    discordVerified,
    xboxVerified,
    playstationVerified,
}) {

    return (

        <div className="flex flex-wrap gap-2 mt-3">

            {steamVerified && (
                <div className="flex items-center gap-2 bg-zinc-800 px-3 py-1 rounded-full">

                    <Gamepad2 className="w-4 h-4 text-green-500" />

                    <span className="text-sm">
                        Steam Verified
                    </span>

                    <BadgeCheck className="w-4 h-4 text-green-500" />

                </div>
            )}

            {discordVerified && (

                <div className="flex items-center gap-2 bg-zinc-800 px-3 py-1 rounded-full">

                    <MessageCircle className="w-4 h-4 text-indigo-500" />

                    <span className="text-sm">
                        Discord Verified
                    </span>

                    <BadgeCheck className="w-4 h-4 text-green-500" />

                </div>

            )}

            {xboxVerified && (

                <div className="flex items-center gap-2 bg-zinc-800 px-3 py-1 rounded-full">

                    <Monitor className="w-4 h-4 text-green-500" />

                    <span className="text-sm">
                        Xbox Verified
                    </span>

                    <BadgeCheck className="w-4 h-4 text-green-500" />

                </div>

            )}

            {playstationVerified && (

                <div className="flex items-center gap-2 bg-zinc-800 px-3 py-1 rounded-full">

                    <Trophy className="w-4 h-4 text-blue-500" />

                    <span className="text-sm">
                        PlayStation Verified
                    </span>

                    <BadgeCheck className="w-4 h-4 text-green-500" />

                </div>

            )}

        </div>

    );

}