import { useRoute, Link } from "wouter";
import { ArrowLeft, Calendar, Clock } from "lucide-react";

interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  readTime: string;
  category: string;
  image: string;
  content: string;
}

const posts: BlogPost[] = [
  {
    slug: "prepare-home-for-cleaner",
    title: "How to Prepare Your Home for a Professional Cleaner",
    excerpt: "Simple steps to get your home ready before the cleaner arrives, ensuring they can work efficiently and cover all areas.",
    date: "May 1, 2026",
    readTime: "4 min read",
    category: "Tips",
    image: "/images/blog-prepare-home.jpg",
    content: `Preparing your home properly for a professional cleaning service isn't just polite—it helps your cleaner work more efficiently and thoroughly. Here's how to make the most of your cleaning appointment.

## Clear the Clutter

The first step is decluttering. Move personal items, toys, and loose objects off surfaces. Your cleaner will spend their time cleaning, not picking things up. A clear kitchen counter takes minutes to clean; a cluttered one takes much longer.

## Do a Quick Sweep

Remove large debris like crumbs, dirt, and spills. This gives your cleaner a clean slate and prevents them from tracking dirt around the house.

## Close Off Unnecessary Areas

If there are rooms you don't need cleaned, mention this when booking. Your cleaner can focus on the areas that matter most to you.

## Check for Hazards

Make sure electrical cords are safely tucked away, wet floors are dry, and pets are secured. This keeps everyone safe and prevents damage.

## Stock Supplies (Optional)

You don't need to provide cleaning supplies—we bring our own eco-friendly products. But if you have specific requests (like glass cleaner for windows), let us know in advance.

## Be Home (or Leave Access)

Be available at your property during your appointment (or have an adult representative present). This ensures safe entry, mutual peace of mind, and means your cleaner can ask questions if needed.

Following these simple steps means your home gets the best possible clean in the shortest time. Your cleaner appreciates it, and you'll see better results.`,
  },
  {
    slug: "eco-friendly-cleaning",
    title: "Why Eco-Friendly Cleaning Matters for Your Family",
    excerpt: "Discover the benefits of plant-based cleaning products for your family, pets, and the environment.",
    date: "April 28, 2026",
    readTime: "5 min read",
    category: "Sustainability",
    image: "/images/blog-eco-friendly.jpg",
    content: `At MakeMeClean, we use plant-based, eco-friendly cleaning products exclusively. But why does this matter? Here's what you should know.

## Safer for Your Family

Traditional cleaning products often contain harsh chemicals like ammonia, bleach, and phosphates. These can:
- Trigger asthma and allergies
- Irritate skin and eyes
- Release harmful fumes
- Accumulate in your home over time

Plant-based products clean just as effectively without these risks. Your kids and pets can safely play on cleaned surfaces immediately after we leave.

## Better for Pets

If you have dogs or cats, you know they spend time on your floors and furniture. Harsh chemicals can cause respiratory issues, skin problems, and toxicity if ingested. Eco-friendly products are non-toxic and safe around pets.

## Environmental Impact

Most conventional cleaning products end up in our water systems, harming aquatic life and ecosystems. Plant-based products are biodegradable and break down naturally without environmental damage.

## Just as Effective

The biggest myth? Eco-friendly products don't clean as well. This simply isn't true. Modern plant-based cleaners are formulated to tackle tough stains, grease, and grime just as effectively as harsh chemicals—sometimes better.

## Cost-Effective

You might expect eco-friendly products to cost more. While they sometimes do at retail, they're highly concentrated, meaning you use less. Over time, they're cost-competitive with conventional cleaners.

## A Small Choice, Big Impact

Choosing eco-friendly cleaning is one of the easiest ways to make your home and the environment healthier. It requires no effort on your part—we handle everything. Every clean with MakeMeClean is a vote for a safer, healthier world.`,
  },
  {
    slug: "spring-cleaning-guide",
    title: "The Ultimate Spring Cleaning Checklist",
    excerpt: "Everything you need to know about spring cleaning your home, room by room.",
    date: "April 20, 2026",
    readTime: "6 min read",
    category: "Guides",
    image: "/images/blog-spring-cleaning.jpg",
    content: `Spring cleaning is more than just a seasonal tradition—it's a chance to refresh your home after winter. Here's your complete room-by-room checklist.

## Kitchen

- Degrease range hood and stovetop
- Clean inside microwave, oven, and fridge
- Wipe down cabinet interiors
- Clean light fixtures and switch plates
- Sanitise bin areas

## Bathrooms

- Scrub tiles and grout
- Clean shower enclosure and tub thoroughly
- Degrease exhaust fan
- Sanitise all surfaces
- Polish mirrors

## Bedrooms

- Wash all bedding (including mattress protectors)
- Dust ceiling fans and light fixtures
- Wipe baseboards
- Clean windows and window sills
- Sanitise door handles and light switches

## Living Spaces

- Dust ceiling corners (cobwebs!)
- Deep clean upholstered furniture
- Polish wood surfaces
- Clean windows inside and out
- Refresh curtains or blinds

## Hallways & Entryways

- Wash walls
- Clean light fixtures
- Sanitise door handles
- Wipe down woodwork
- Polish mirrors

## Pro Tips

**Declutter First**: Remove items you don't use. Spring cleaning is the perfect time to donate or discard.

**Work Top-to-Bottom**: Dust falls down, so clean ceilings first, then work your way down.

**Don't Tackle Everything at Once**: Spread spring cleaning over two weeks. One room per weekend is manageable.

**Let the Professionals Help**: Deep spring cleaning is exhausting. Consider booking our Spring Clean service—we handle all the heavy lifting while you focus on decluttering.

Spring cleaning doesn't have to be overwhelming. With a plan and realistic expectations, you can refresh your home and start the season fresh.`,
  },
  {
    slug: "recurring-cleaning-benefits",
    title: "Why Regular Cleaning Saves You Time, Money & Stress",
    excerpt: "The smart reasons to schedule recurring cleanings instead of doing one-off deep cleans.",
    date: "April 15, 2026",
    readTime: "5 min read",
    category: "Tips",
    image: "/images/blog-recurring-cleaning.jpg",
    content: `Many people book a cleaner once and think that's enough. But recurring weekly or fortnightly cleanings actually save time, money, and stress. Here's why.

## Prevents Buildup

When you clean regularly, dirt and grime don't accumulate. Dust doesn't gather on surfaces, bathrooms stay sanitary, and floors stay fresh. When buildup occurs, cleaning takes longer and costs more.

## Costs Less Overall

A quick weekly clean is faster and cheaper than a deep clean every few months. Regular maintenance prevents the need for expensive deep cleaning services.

## Saves Your Time

Weekly cleaning takes 2-3 hours with a professional. Without it, you'd spend 4-5 hours doing it yourself. Over a year, that's 50-100+ hours of your free time back.

## Reduces Stress

Knowing your home is professionally cleaned regularly removes the anxiety of "I need to clean!" and the guilt when life gets too busy. You come home to a clean space, always.

## Better for Your Health

Regular cleaning means fewer allergens, dust, and bacteria in your home. This is especially important if anyone has asthma, allergies, or respiratory sensitivities.

## Preserves Your Home

Neglected surfaces, grout, and fixtures deteriorate faster. Regular cleaning maintains your home's condition and protects your investment.

## Numbers Don't Lie

- **Weekly cleaning**: ~£40–60/week = ~£2,000–3,000/year
- **Time saved**: 100+ hours/year
- **Stress reduced**: Significant
- **Home value maintained**: Priceless

Compare this to doing it yourself or hiring for expensive deep cleans, and regular professional cleaning is clearly the smart choice.

**Pro Tip**: New to recurring cleanings? Start with fortnightly and upgrade to weekly if you'd like. Most customers find weekly cleaning is worth every penny.`,
  },
  {
    slug: "deep-clean-vs-regular",
    title: "Deep Clean vs. Regular Clean: Which Do You Need?",
    excerpt: "Understand when you need a deep clean and how it differs from a standard cleaning service.",
    date: "April 10, 2026",
    readTime: "4 min read",
    category: "Guides",
    image: "/images/blog-deep-clean.jpg",
    content: `Confused about the difference between a regular clean and a deep clean? You're not alone. Here's what each includes and when you need them.

## Regular Clean (Standard Service)

**What's Included:**
- Vacuum and mop floors
- Dust surfaces and furniture
- Clean bathrooms (toilet, sink, shower)
- Clean kitchen surfaces
- Tidy and organise clutter
- Empty bins

**Timeline:** 2–4 hours depending on home size

**Best For:**
- Maintaining a clean home between deep cleans
- Weekly or fortnightly recurring cleanings
- Homes that are already in relatively good condition

**Cost:** £50–100+ (varies by home size and location)

## Deep Clean

**What's Included:**
- Everything in a regular clean, PLUS:
- Clean inside ovens and microwaves
- Degrease range hoods and stovetops
- Scrub grout and tiles
- Clean inside cupboards and drawers
- Dust ceiling corners and fixtures
- Polish baseboards and woodwork
- Clean behind and under furniture
- Sanitise high-touch areas thoroughly

**Timeline:** 5–8 hours depending on home size

**Best For:**
- Spring or seasonal cleaning
- Moving into a new home
- Homes that haven't been professionally cleaned in months
- After significant life events (renovation, parties, illness)

**Cost:** £150–300+ (varies significantly by home size)

## How to Decide

**Choose Regular Clean if:**
- You clean regularly or have a recurring schedule
- Your home is already in good condition
- You want maintenance between deep cleans
- Budget is a priority

**Choose Deep Clean if:**
- You haven't had professional cleaning in 6+ months
- You're moving homes
- You want a thorough, top-to-bottom refresh
- Specific areas need intensive attention

## Our Recommendation

Most customers benefit from **regular fortnightly cleans with a deep clean 2–3 times per year** (spring, summer, autumn). This keeps your home consistently fresh without the expense of deep cleaning every time.

Not sure which you need? Contact us and we'll assess your home and make a recommendation. Every home is different, and we'll find the right solution for you.`,
  },
  {
    slug: "cleaning-for-airbnb",
    title: "The Complete Guide to Airbnb Turnover Cleaning",
    excerpt: "Professional tips for fast, thorough cleaning between guests to maintain your rental rating.",
    date: "April 5, 2026",
    readTime: "5 min read",
    category: "Business",
    image: "/images/blog-airbnb.jpg",
    content: `If you host an Airbnb, you know that turnovers are critical. Fast, thorough cleaning keeps guests happy and your ratings high. Here's how to streamline the process.

## The Turnover Timeline

**Ideal scenario**: Guest checks out by 11am, next guest checks in at 3pm. That's 4 hours to clean thoroughly.

**With professional help:** This is absolutely doable. Without it? Nearly impossible if you want standards high.

## The Airbnb Cleaning Checklist

### Bedrooms
- Strip and wash all bedding immediately
- Vacuum under the bed and furniture
- Dust all surfaces
- Sanitise door handles and light switches
- Inspect for damage or stains
- Refresh pillows and mattresses

### Bathrooms
- Sanitise all surfaces thoroughly
- Scrub toilet, sink, and shower/tub
- Restock toiletries and linens
- Replace shower curtain liners if used
- Clean mirrors and fixtures
- Check for mold or mildew

### Kitchen
- Sanitise all counters and appliances
- Empty and clean fridge
- Wipe down cabinets
- Clean stovetop and sink
- Restock basics (tea, coffee, condiments)
- Ensure all dishes are clean and stored

### Living Spaces
- Dust all surfaces
- Vacuum/sweep and mop
- Clean windows
- Wipe down furniture
- Empty bins and replace liners
- Check for clutter or damage

### Key Areas
- Wipe down all door handles
- Sanitise TV remotes
- Clean light switches
- Vacuum stairs
- Check carpet for stains

## Pro Tips for Airbnb Success

**1. Create a System**
Develop a consistent process. The same sequence every time means nothing gets missed and you get faster.

**2. Prepare Supplies**
Keep cleaning supplies stocked and accessible. Wasted time searching for supplies adds up.

**3. Replace, Don't Just Clean**
Guests notice fresh items. Replace shower curtain liners, refresh towels, and restock amenities.

**4. Document Everything**
Take photos of the clean property before guests arrive. This protects you and provides evidence of condition.

**5. Hire Professionals**
Between-guest cleaning is where most Airbnb hosts struggle. Professional cleaners ensure consistency, speed, and high standards—which directly impact your guest reviews.

## The Math

A professional turnover clean costs £80–150. A negative review from poor cleanliness? That costs thousands in lost bookings.

Most successful Airbnb hosts use professional cleaning for every turnover. It's not an expense—it's an investment in your business success.

**Ready to outsource your Airbnb cleaning?** Contact us about our dedicated Airbnb turnover service with same-day availability.`,
  },
];

function renderInlineBold(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i} className="font-bold text-gray-900">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

export default function BlogArticle() {
  const [, params] = useRoute("/blog/:slug");
  const slug = params?.slug;

  const post = posts.find((p) => p.slug === slug);

  if (!post) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Article Not Found</h1>
          <p className="text-gray-600 mb-6">Sorry, this article doesn't exist.</p>
          <Link href="/blog" className="btn-primary inline-block">
            Back to Blog
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-gray-50 border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Link href="/blog" className="inline-flex items-center gap-2 text-green-600 hover:text-green-700 mb-6 text-sm font-medium">
            <ArrowLeft className="w-4 h-4" />
            Back to Blog
          </Link>
          <div className="inline-block px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full mb-4">
            {post.category}
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6 leading-tight">{post.title}</h1>
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              {post.date}
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              {post.readTime}
            </div>
          </div>
        </div>
      </div>

      {/* Featured Image */}
      <div className="bg-white">
        <img
          src={post.image}
          alt={post.title}
          className="w-full h-96 object-cover"
        />
      </div>

      {/* Content */}
      <div className="bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
          <div className="prose prose-lg max-w-none text-gray-700">
            {post.content.split('\n\n').map((paragraph, idx) => {
              if (paragraph.startsWith('### ')) {
                return (
                  <h3 key={idx} className="text-xl font-bold text-gray-900 mt-6 mb-3">
                    {paragraph.slice(4)}
                  </h3>
                );
              }
              if (paragraph.startsWith('## ')) {
                return (
                  <h2 key={idx} className="text-2xl font-bold text-gray-900 mt-8 mb-4">
                    {paragraph.slice(3)}
                  </h2>
                );
              }
              if (paragraph.startsWith('- ')) {
                return (
                  <ul key={idx} className="list-disc list-inside space-y-2 mb-4 text-gray-700">
                    {paragraph.split('\n').map((item, i) => (
                      <li key={i}>{renderInlineBold(item.replace(/^- /, ''))}</li>
                    ))}
                  </ul>
                );
              }
              if (paragraph.includes('\n- ')) {
                const [lead, ...items] = paragraph.split('\n');
                return (
                  <div key={idx} className="mb-6">
                    <p className="mb-2 leading-relaxed">{renderInlineBold(lead)}</p>
                    <ul className="list-disc list-inside space-y-2 text-gray-700">
                      {items.map((item, i) => (
                        <li key={i}>{renderInlineBold(item.replace(/^- /, ''))}</li>
                      ))}
                    </ul>
                  </div>
                );
              }
              return (
                <p key={idx} className="mb-6 leading-relaxed">
                  {renderInlineBold(paragraph)}
                </p>
              );
            })}
          </div>

          {/* CTA */}
          <div className="mt-12 pt-8 border-t border-gray-200">
            <div className="bg-green-50 rounded-xl p-8 text-center">
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Ready to get your home clean?</h3>
              <p className="text-gray-600 mb-6">Book a professional cleaning service today.</p>
              <Link href="/book" className="btn-primary inline-block">
                Book a Clean
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
