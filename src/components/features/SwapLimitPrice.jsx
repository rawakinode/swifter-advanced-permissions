import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"

export default function SwapLimitPrice({ fromAmount, toToken, exchangeRate, onChange }) {

    const [limitPrice, setLimitPrice] = useState({ price: exchangeRate })
    const [newPrice, setNewPrice] = useState(0);

    useEffect(() => {
        const amount = parseFloat(fromAmount || 0) * parseFloat(limitPrice.price || 0);
        const price = newPrice;
        onChange({amount: amount.toFixed(Number(toToken.decimals)), price})
    }, [limitPrice, fromAmount, onChange, exchangeRate])

    const handleHelperClick = (type) => {
        let newPrice = parseFloat(limitPrice.price || exchangeRate)

        if (type === "market") newPrice = exchangeRate
        if (type === "10%") newPrice = exchangeRate * 1.1
        if (type === "20%") newPrice = exchangeRate * 1.2
        if (type === "50%") newPrice = exchangeRate * 1.5
        if (type === "100%") newPrice = exchangeRate * 2

        setLimitPrice({ price: newPrice });
        setNewPrice(newPrice);
    }

    return (
        <div className="w-full space-y-3">
            <Label className="text-xs text-muted-foreground">Set Limit Price</Label>

            <div className="flex items-center gap-2 mt-2">
                <Input
                    type="number"
                    value={limitPrice.price}
                    onChange={(e) => {
                        setLimitPrice({ price: e.target.value });
                        setNewPrice(e.target.value);
                    }}
                    placeholder="Enter price"
                    className="text-sm"
                />
                <span className="text-xs font-medium">{toToken?.symbol}</span>
            </div>

            <div className="flex flex-wrap gap-2">
                <Button className="text-xs" size="sm" variant="outline" onClick={() => handleHelperClick("market")}>
                    Now
                </Button>
                <Button className="text-xs" size="sm" variant="outline" onClick={() => handleHelperClick("10%")}>
                    +10%
                </Button>
                <Button className="text-xs" size="sm" variant="outline" onClick={() => handleHelperClick("20%")}>
                    +20%
                </Button>
                <Button className="text-xs" size="sm" variant="outline" onClick={() => handleHelperClick("50%")}>
                    +50%
                </Button>
                <Button className="text-xs" size="sm" variant="outline" onClick={() => handleHelperClick("100%")}>
                    +100%
                </Button>
            </div>
        </div>
    )
}
